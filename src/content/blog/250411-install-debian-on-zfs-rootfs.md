---
icon: "💽"
title: "ZFS rootfs에 Debian 12 설치"
description: "OpenZFS를 통하여 ZFS 루트 파일 시스템에 Debian 12 Bookworm 설치하기"
pubDate: "2025-04-11T07:15:00.000Z"
---

## 면책
본문은 컴퓨터 저장 장치의 재구성 명령어 등 데이터 손실의 위험성이 매우 높은 내용을 포함합니다. 본문을 따라하는 것은 개인의 선택이며, 실행 결과로 인한 일체의 손실에 대해서는 글 작성자에게 책임이 없습니다.

## 프롤로그
ZFS(Zettabyte File System)는 스냅샷, RAIDZ, 압축, 복제, 중복 제거 등 고급 기능을 포함하고, 높은 안정성을 제공하는 파일 시스템입니다. 저는 ZFS의 여러 장점에 만족하며, 제게 권한이 있는 대부분의 시스템을 ZFS로 운영하고 있습니다.  

대부분의 유닉스 호환 운영체제에서 사용할 수 있습니다. 다만, 현재 TrueNAS SCALE이나 Proxmox를 제외하면 인기있는 Linux 배포판 대부분에서 루트 파일 시스템으로 ZFS를 지원하지 않습니다. 이에, OpenZFS를 이용하여 Debian 12 Bookworm 설치 과정을 정리하였습니다.

## 구성 요소
* [Debian 12 Bookworm 설치 미디어](https://cdimage.debian.org/debian-cd/current/amd64/iso-dvd/)
* OpenZFS

## 설치 준비
* 2시간 정도의 여유 시간
* 콘솔 직접 액세스(물리적, BMC, iDRAC, ILO 등)
* 인터넷 연결
* Debian Live CD 또는 이에 준하는 설치 미디어

## 설치 과정
### 설치 계획
이 글에서는 다음의 계획을 전제로 하여 설치를 수행합니다.
* Linux 배포판으로 Debian 12 Bookworm을 사용합니다.
* 이더넷 인터페이스 이름은 `eth0`입니다.
* IPv4는 DHCP 없이 정적으로 구성합니다. (`172.16.0.10/24`, `0.0.0.0/0` -> `172.16.0.1`)
* 호스트네임과 도메인은 각각 `host-1`, `donghoon.net`입니다.
* 부팅 영역과 운영체제 및 사용자 데이터의 zpool 이름은 각각 `bpool`, `rpool`입니다.
* Samsung SSD 980 PRO 2TB 2개에 복제된 파일 시스템을 구성합니다.
* `bpool`을 제외한 나머지 영역을 [zstd(Zstandard)](http://facebook.github.io/zstd/)로 압축합니다.
* 성능 저하 이슈가 있는 관계로 중복 제거는 사용하지 않습니다. 이후 활성화할 수 있으나 해제할 수는 없습니다.
* 그 외 중요도가 낮은 선택사항에 대해서는 OpenZFS 권장 사항을 따릅니다.

### 설치 환경 구성
1. Debian Live CD로 부팅, 터미널 실행 이후 루트 쉘을 활성화합니다.
    ```shell
    sudo su
    ```
1. 인터넷 연결
    ```shell
    vi /etc/network/interfaces
    ```
    ```text title="/etc/network/interfaces"
    auto lo
    iface lo inet loopback

    auto eth0
    iface eth0 inet static
    address 172.16.0.10
    netmask 255.255.255.0
    gateway 172.16.0.1
    ```
    ```shell
    vi /etc/resolv.conf
    ```
    ```text title="/etc/resolv.conf"
    nameserver 9.9.9.9
    nameserver 149.112.112.112
    ```
1. (선택 사항: Live 환경에서 복사•붙여넣기가 곤란한 경우 사용) OpenSSH 서버를 활성화합니다.
    ```shell
    apt-get update -y
    apt-get install -y openssh-server 
    vi /etc/ssh/sshd_config
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
    sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
    systemctl enable --now ssh
    ```
    Debian Live CD의 기본 계정은 `live`, 암호는 `pass`입니다.

### 설치 준비
1. 부트로더와 운영체제를 설치할 디스크를 결정합니다.  
    * 여러 개의 디스크에 설치하려는 경우, 하나의 파일 시스템에는 용량이 모두 같은 디스크를 사용하는 것이 권장됩니다. 용량이 다른 경우 경고가 표시됩니다.
    * 아래 상황에서는 `nvme-Samsung_SSD_980_PRO_2TB_***************`가 됩니다. `*`로 마스킹한 자리에는 장치 시리얼 번호가 위치하는데, 이를 통하여 개별 디스크를 식별하면 됩니다.
    * 이후에는 시리얼 번호로 `11111111`과 `22222222`를 예로 들겠습니다.
    * `-part`, `_1`과 같은 것은 무시합니다.
    ```shell
    ls /dev/disk/by-id
    ```
    ```
    nvme-Samsung_SSD_980_PRO_2TB_***************
    nvme-Samsung_SSD_980_PRO_2TB_***************-part1
    nvme-Samsung_SSD_980_PRO_2TB_***************_1
    nvme-Samsung_SSD_980_PRO_2TB_***************_1-part1
    nvme-Samsung_SSD_980_PRO_2TB_***************
    nvme-Samsung_SSD_980_PRO_2TB_***************-part1
    nvme-Samsung_SSD_980_PRO_2TB_***************_1
    nvme-Samsung_SSD_980_PRO_2TB_***************_1-part1
    ```

### OpenZFS로 파일 시스템 초기화
1. OpenZFS를 설치합니다.
    ```shell
    cat <<EOF | tee /etc/apt/sources.list
    deb http://deb.debian.org/debian/ bookworm main contrib non-free-firmware
    deb-src http://deb.debian.org/debian/ bookworm main contrib non-free-firmware
    deb [trusted=yes] file:/run/live/medium bookworm main non-free-firmware
    EOF
    apt-get update -y
    apt-get install -y debootstrap gdisk zfsutils-linux
    ```
1. Live CD에서 자동 디스크 마운트를 비활성화합니다.
    ```shell
    gsettings set org.gnome.desktop.media-handling automount false
    ```
1. 파일 시스템에 사용할 모든 디스크를 초기화합니다.
    만약, 하나의 파일 시스템에 각 디스크의 크기가 다른 경우, 이를 통일하기 위하여 `sgdisk`에서 offset 값을 다르게 지정하는 것이 권장됩니다.
    ```shell
    CDISK=/dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111

    swapoff --all
    wipefs -a $CDISK
    blkdiscard -f $CDISK
    sgdisk --zap-all $CDISK
    sgdisk -n2:1M:+512M -t2:EF00 $CDISK
    sgdisk -n3:0:+1G -t3:BF01 $CDISK
    sgdisk -n4:0:0 -t4:BF00 $CDISK

    # 파일 시스템에 사용할 모든 디스크에 대해 반복하세요.
    ```
1. `bpool`을 생성합니다. 단일 디스크 여부에 따라 명령어가 다르므로 아래 내용을 자세히 확인하세요.
    ```shell
    # 단일 디스크의 경우:
    zpool create \
        -o ashift=12 \
        -o autotrim=on \
        -o compatibility=grub2 \
        -o cachefile=/etc/zfs/zpool.cache \
        -O devices=off \
        -O acltype=posixacl -O xattr=sa \
        -O compression=off \
        -O normalization=formD \
        -O relatime=on \
        -O canmount=off -O mountpoint=/boot -R /mnt \
        bpool /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111-part3

    # 복수 디스크의 경우:
    zpool create \
        -o ashift=12 \
        -o autotrim=on \
        -o compatibility=grub2 \
        -o cachefile=/etc/zfs/zpool.cache \
        -O devices=off \
        -O acltype=posixacl -O xattr=sa \
        -O compression=off \
        -O normalization=formD \
        -O relatime=on \
        -O canmount=off -O mountpoint=/boot -R /mnt \
        bpool mirror \
        /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111-part3 \
        /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_22222222-part3
    ```
1. `rpool`을 생성합니다. 단일 디스크 여부에 따라 명령어가 다르므로 아래 내용을 자세히 확인하세요.
    ```shell
    # 단일 디스크의 경우:
    zpool create \
        -o ashift=12 \
        -o autotrim=on \
        -O acltype=posixacl -O xattr=sa -O dnodesize=auto \
        -O compression=zstd \
        -O normalization=formD \
        -O relatime=on \
        -O canmount=off -O mountpoint=/ -R /mnt \
        rpool /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111-part4

    # 복수 디스크의 경우:
    zpool create \
        -o ashift=12 \
        -o autotrim=on \
        -O acltype=posixacl -O xattr=sa -O dnodesize=auto \
        -O compression=zstd \
        -O normalization=formD \
        -O relatime=on \
        -O canmount=off -O mountpoint=/ -R /mnt \
        rpool mirror \
        /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111-part4 \
        /dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_22222222-part4
    ```
1. `bpool`을 위한 데이터셋을 생성합니다. 데이터셋 이름은 선호에 따라 달리 구성할 수 있으나, 마운트포인트는 임의 변경이 허용되지 않습니다.
    ```shell
    zfs create -o canmount=off -o mountpoint=none bpool/BOOT
    zfs create -o mountpoint=/boot bpool/BOOT/debian
    ```
1. `rpool`을 위한 기본 데이터셋을 생성합니다. 데이터셋 이름은 선호에 따라 달리 구성할 수 있으나, 마운트포인트는 임의 변경이 허용되지 않습니다. ZFS 기능 속성을 달리할 목적으로 하위 데이터셋을 생성할 수 있습니다. 여기에서는 OpenZFS 권장 사항을 따릅니다.
    ```shell
    zfs create -o canmount=off -o mountpoint=none rpool/ROOT
    
    zfs create -o canmount=noauto -o mountpoint=/ rpool/ROOT/debian
    
    zfs create rpool/home
    zfs create -o mountpoint=/root rpool/home/root
    
    zfs create -o canmount=off rpool/var
    zfs create -o canmount=off rpool/var/lib
    zfs create rpool/var/log
    zfs create rpool/var/spool
    
    zfs create -o canmount=off rpool/usr
    zfs create rpool/usr/local
    
    zfs mount rpool/ROOT/debian
    chmod 700 /mnt/root
    ```
1. `rpool`에 스냅샷이 불필요한 데이터셋을 분리 생성합니다.
    ```shell
    zfs create -o com.sun:auto-snapshot=false rpool/var/cache
    zfs create -o com.sun:auto-snapshot=false rpool/var/lib/nfs
    zfs create -o com.sun:auto-snapshot=false rpool/var/tmp
    zfs create -o com.sun:auto-snapshot=false -o compression=off rpool/tmp
    chmod 1777 /mnt/var/tmp
    chmod 1777 /mnt/tmp
    ```

### Debian 12 Bookworm 설치
1. Debian 12 Bookworm을 설치합니다.
    ```shell
    mkdir /mnt/run
    mount -t tmpfs tmpfs /mnt/run
    mkdir /mnt/run/lock

    debootstrap bookworm /mnt
    ```
1. 설치 과정에서 생성되었던 ZFS 캐시를 파일 시스템에 복사합니다.
    ```shell
    mkdir /mnt/etc/zfs
    cp /etc/zfs/zpool.cache /mnt/etc/zfs/
    ```
1. 운영체제 호스트네임과 도메인을 설정합니다.
    ```shell
    NEW_HOSTNAME=host-1
    NEW_DOMAIN=donghoon.net

    hostname $NEW_HOSTNAME$NEW_DOMAIN
    hostname > /mnt/etc/hostname
    cat <<EOF | tee /mnt/etc/hosts
    127.0.0.1	localhost ${NEW_HOSTNAME} ${NEW_HOSTNAME}${NEW_DOMAIN}
    ::1		localhost ip6-localhost ip6-loopback
    ff02::1		ip6-allnodes
    ff02::2		ip6-allrouters
    EOF
    ```
1. 운영체제 기본 이더넷 인터페이스를 구성합니다. 운영체제를 위한 것이므로 DHCP를 사용합니다. 만약, 다른 선호 사항이 있는 경우 정적 IP 주소를 설정해도 됩니다.
    ```shell
    NEW_INTERFACE=eth0

    cat <<EOF | tee /mnt/etc/network/interfaces.d/$NEW_INTERFACE
    auto $NEW_INTERFACE
    iface $NEW_INTERFACE inet dhcp
    EOF
    ```
1. 운영체제의 패키지 관리자를 구성합니다.
    ```shell
    cat <<EOF | tee /mnt/etc/apt/sources.list
    deb http://deb.debian.org/debian bookworm main contrib non-free-firmware
    deb-src http://deb.debian.org/debian bookworm main contrib non-free-firmware

    deb http://deb.debian.org/debian-security bookworm-security main contrib non-free-firmware
    deb-src http://deb.debian.org/debian-security bookworm-security main contrib non-free-firmware

    deb http://deb.debian.org/debian bookworm-updates main contrib non-free-firmware
    deb-src http://deb.debian.org/debian bookworm-updates main contrib non-free-firmware
    EOF
    ```
1. 운영체제 기본 사항을 구성하기 위하여 `chroot`를 통하여 임시로 루트를 변경합니다.
    ```shell
    mount --make-private --rbind /dev /mnt/dev
    mount --make-private --rbind /proc /mnt/proc
    mount --make-private --rbind /sys /mnt/sys
    chroot /mnt /usr/bin/env bash --login
    ```
1. 운영체제의 패키지 관리자를 업데이트하고 시간, 키보드 및 콘솔을 구성합니다.
    ```shell
    apt-get update -y

    apt-get install -y console-setup locales
    dpkg-reconfigure locales tzdata keyboard-configuration console-setup
    ```
1. 운영체제의 ZFS 및 파일 시스템을 구성합니다.
    ```shell
    apt-get install -y dpkg-dev linux-headers-generic linux-image-generic
    apt-get install -y zfs-initramfs
    echo REMAKE_INITRD=yes > /etc/dkms/zfs.conf

    cat <<EOF | tee /etc/systemd/system/zfs-import-bpool.service
    [Unit]
    DefaultDependencies=no
    Before=zfs-import-scan.service
    Before=zfs-import-cache.service

    [Service]
    Type=oneshot
    RemainAfterExit=yes
    ExecStart=/sbin/zpool import -N -o cachefile=none bpool
    # Work-around to preserve zpool cache:
    ExecStartPre=-/bin/mv /etc/zfs/zpool.cache /etc/zfs/preboot_zpool.cache
    ExecStartPost=-/bin/mv /etc/zfs/preboot_zpool.cache /etc/zfs/zpool.cache

    [Install]
    WantedBy=zfs-import.target
    EOF
    systemctl enable zfs-import-bpool.service

    cp /usr/share/systemd/tmp.mount /etc/systemd/system/
    systemctl enable tmp.mount
    ```
1. 운영체제 기본 패키지를 설치합니다.
    ```shell
    # 권장:
    apt-get install -y \
        systemd-timesyncd \
        openssh-server \
        curl \
        vim \
        apt-transport-https \
        ca-certificates
    
    # 선택:
    apt-get install -y \
        net-tools \
        iputils-ping \
        traceroute \
        tar \
        zip \
        unzip
    ```
1. 부트로더를 설치합니다. 1개 디스크에 대해서만 수행하면 되며, 설치에 성공한 이후 나머지 디스크에 복사합니다.
    ```shell
    apt-get install -y dosfstools

    CDISK=/dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111

    mkdosfs -F 32 -s 1 -n EFI ${CDISK}-part2
    mkdir /boot/efi
    echo ${CDISK}-part2 \
    /boot/efi vfat defaults 0 0 >> /etc/fstab
    mount /boot/efi
    apt-get install -y grub-efi-amd64 shim-signed

    grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=debian --recheck --no-floppy

    grub-probe /boot
    update-initramfs -c -k all
    sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="quiet"/GRUB_CMDLINE_LINUX_DEFAULT=""/' /etc/default/grub
    sed -i 's/^GRUB_CMDLINE_LINUX=""/GRUB_CMDLINE_LINUX="root=ZFS=rpool\/ROOT\/debian"/' /etc/default/grub
    update-grub

    apt purge -y os-prober
    ```
1. 파일 시스템 마운트 순서를 변경합니다.
    1. `zfs-mount-generator`를 활성화합니다.
        ```shell
        mkdir /etc/zfs/zfs-list.cache
        touch /etc/zfs/zfs-list.cache/bpool
        touch /etc/zfs/zfs-list.cache/rpool
        zed -F &
        ```
    1. 강제로 캐시를 업데이트합니다.
        ```shell
        zfs set canmount=on bpool/BOOT/debian
        zfs set canmount=noauto rpool/ROOT/debian
        ```
    1. `zfs-mount-generator`로 돌아온 다음, 인터럽트 신호를 보냅니다.(`Ctrl`+`C` 키 조합 누르기)
        ```
        fg
        ```
    1. ZFS 캐시에서 `/mnt`로 시작하는 경로를 고칩니다.
        ```shell
        sed -Ei "s|/mnt/?|/|" /etc/zfs/zfs-list.cache/*
        ```
1. (선택 사항: 사용자 계정으로 `root`를 사용할 것이고, 암호 기반 로그인을 사용하려는 경우에만 설정하세요.) 운영체제의 `root` 계정 암호를 설정합니다.
    ```shell
    passwd
    ```
1. (선택 사항: OpenSSH 서버를 사용하려는 경우에만 수행하세요.) OpenSSH 서버를 활성화합니다.
    ```shell
    systemctl enable ssh
    ```
    OpenSSH 서버를 통한 `root` 로그인, 암호 기반 로그인 허용은 보안상 권장되지 않습니다.
    1. (선택 사항: `root` 계정 로그인을 사용하려는 경우에만 설정하세요.) `root` 계정으로 로그인을 허용합니다.
        ```shell
        sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
        ```
    1. (선택 사항: 암호로 로그인을 사용하려는 경우에만 설정하세요.) 암호로 로그인을 허용합니다.
        ```shell
        sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
        ```
1. (선택 사항) 여기까지의 과정을 스냅샷으로 생성합니다.
    ```shell
    zfs snapshot bpool/BOOT/debian@install
    zfs snapshot rpool/ROOT/debian@install
    ```
1. 운영체제 루트에서 나옵니다.
    ```shell
    exit
    ```

### 설치 마무리
1. 모든 ZFS 파일 시스템을 마운트 해제합니다.
    ```shell
    mount | grep -v zfs | tac | awk '/\/mnt/ {print $3}' | \
        xargs -i{} umount -lf {}
    zpool export -a
    ```
1. 다시 시작합니다.
    ```shell
    reboot
    ```
1. 만약, 다시 시작하는 과정에서 오류가 발생하여 `initramfs` 쉘이 나타나는 경우, 아래 명령어를 입력하여 `rpool`을 강제로 불러온 다음 `initramfs` 쉘에서 나옵니다.
    ```shell
    zpool import -f rpool
    exit
    ```
1. 부트로더를 다른 디스크에도 복사합니다.
    ```shell
    # 처음 부트로더를 설치했던 디스크입니다.
    PDISK=/dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_11111111
    ```
    ```shell
    umount /boot/efi
    ```
    ```shell
    # 부트로더를 복사 받을 대상 디스크입니다.
    CDISK=/dev/disk/by-id/nvme-Samsung_SSD_980_PRO_2TB_22222222

    dd if=$PDISK-part2 of=$CDISK-part2
    efibootmgr -c -g -d $CDISK -p 2 -L "debian-2" -l '\EFI\debian\grubx64.efi'

    # 파일 시스템에 사용할 나머지 디스크에 대해 반복하세요.
    ```
    ```shell
    mount /boot/efi
    ```
1. 배포판 업그레이드를 수행하고 필요한 소프트웨어셋을 설치합니다. 그런 다음, 다시 시작합니다.
    ```shell
    apt dist-upgrade -y
    tasksel --new-install
    reboot
    ```
1. (선택 사항) 최초 설치 이후 스냅샷을 생성합니다.
    ```shell
    zfs snapshot bpool/BOOT/debian@postinstall
    zfs snapshot rpool/ROOT/debian@postinstall
    ```
1. 패키지 관리자를 업데이트하고 패키지를 업그레이드합니다.
    ```shell
    apt-get update -y
    apt-get upgrade -y
    ```

## 에필로그
이 글에서는 Ubuntu 대신 Debian을 선택하고 있습니다. 그 이유로, 저는 최근 Ubuntu 운영체제 개발과 내장 패키지의 선택 철학이 제 뜻과 같지 않다는 생각이 들어 Rocky Linux, openSUSE, Debian을 사용하고 있기 때문입니다.  

앞서 언급한 것과 같이 ZFS는 여러 기능을 포함하고도 높은 신뢰성을 제공하는 파일 시스템입니다. 모두가 번거로운 과정을 생략하고도 장점들을 누릴 수 있도록, 많은 Linux 배포판에서 ZFS 지원을 기본으로 추가하는 날이 오기를 기대합니다.