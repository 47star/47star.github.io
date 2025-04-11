---
icon: "💾"
title: "Linux에서 WWID로 디스크 디바이스 식별"
description: "Linux에서 장치 구분이 안되는 경우 naa로 시작하는 WWID로 디스크 디바이스 식별하는 방법"
pubDate: "2025-04-11T08:40:00.000Z"
---

## 프롤로그
Linux에서는 디스크 디바이스를 지정하는 데 주로 `/dev/sda`, `/dev/sdb`, `/dev/sd...` 등의 디바이스를 참조합니다. 
그런데 이 값은 재부팅 시마다 변할 수 있어서 항상 동일한 디스크를 참조하기 어렵습니다. 대신 `/dev/disk/by-id`를 참조할 수 있고, 
여기에서 디스크 이름은 디스크 컨트롤러의 펌웨어에서 제공하는 디스크 이름과 시리얼 번호로 구성됩니다. 
드물게 디스크 컨트롤러 고유의 값을 존중해주지 않는 잘못 구현된 SCSI 컨트롤러가 있을 수 있습니다. 이 경우, 디스크 이름과 시리얼 번호가 
모두 동일하게 나타나서 디스크를 제대로 식별할 수 없게 됩니다.  

이러한 문제를 해결하기 위해 `naa`로 시작하는 WWID(World Wide Identifier)를 사용하여 디스크를 식별하는 방법도 있습니다. 
WWID는 디스크 제조사에서 할당하는 고유한 식별자이므로 중복되지 않습니다.

## WWID 조회 방법
Linux의 `udevadm`으로 WWID를 포함한 디스크 속성을 조회할 수 있습니다.

```shell
# 예:
udevadm info --name=/dev/sda --attribute-walk | grep wwid
udevadm info --name=/dev/nvme0n1 --attribute-walk | grep wwid
```

## WWID 기반 디스크 디바이스 심볼릭 링크 생성
이를 기반으로 커널에서 식별이 용이하도록 `udev`(udev; Userspace /dev for Linux kernel)를 구성해두면, 
부팅 시점에 디스크 디바이스를 고유하게 식별할 수 있습니다.

`/etc/udev/rules.d` 이하에 파일로 구성하면 됩니다. 이 글에서는 `/etc/udev/rules.d/99-usb.rules`에 구성하였습니다.

1. udev rules 생성
    ```shell
    vi /etc/udev/rules.d/99-usb.rules
    ```
    ```
    # 예:
    ATTRS{wwid}=="naa.????????????????", SYMLINK+="ata_TOSHIBA_??????????_?????????"
    ATTRS{wwid}=="naa.????????????????", SYMLINK+="ata_CT2000MX500SSD1_????????????"
    ```
1. udev 적용
    ```shell
    udevadm control --reload-rules
    udevadm trigger
    ```
1. 결과 확인
    ```shell
    ls -l /dev/ata_*
    ```

## 에필로그
클라우드나 벤더 서버만 사용하면 이 글에서 다루는 경우에 직면할 일은 거의 없습니다.