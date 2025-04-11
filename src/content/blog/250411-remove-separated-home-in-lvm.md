---
icon: "💾"
title: "LVM에 Linux 설치 이후 분리된 /home 영역 제거"
description: "LVM에 Rocky Linux를 설치한 이후 분리된 /home 영역 제거하는 방법"
pubDate: "2025-04-11T07:20:00.000Z"
---

## 책임의 한계 
이 글은 파일 시스템을 조작하는 명령어를 포함하며, 이는 잠재적으로 데이터 손실의 결과를 초래할 위험성이 매우 높습니다. 이 글을 따라하는 것은 개인의 선택이며, 실행 결과로 인한 일체의 손실에 대해서는 글 작성자에게 책임이 없습니다.

## 프롤로그
Rocky Linux를 비롯한 주요 Linux 배포판을 LVM으로 설치하면 `/home` 영역이 분리되어 있습니다. 
저는 root privileges를 남용하는 대부분의 경우나 Kubernetes 노드인 경우 `/home` 분리의 상당한 의의가 퇴색된다고 생각합니다. 
이러한 이유로, 설치 과정에서부터 파티션을 수동으로 정의하여 제거하는 경우가 있습니다. 간혹 이 과정을 잊고 설치한 경우가 있어 설치 이후에 이를 제거할 방법을 정리하였습니다.  

파일 시스템을 변경하지 전에 데이터를 백업할 것을 권장하며, `df -h`, `lsblk` 등의 명령으로 파티션 상태를 인지한 상태로 진행하세요.

## 제거 방법
1. 시스템에서 `/home`을 마운트 해제합니다.
    ```shell
    umount /home
    ```
1. 기존 `/home`을 `/mnt/oldhome`에 임시로 마운트합니다.
    ```shell
    mkdir /mnt/oldhome
    mount /dev/mapper/rl-home /mnt/oldhome
    ```
1. 임시 `/mnt/oldhome`에서 `/home`으로 자료를 복사합니다.
    ```shell
    mkdir -p /home
    rsync -a /mnt/oldhome/ /home/
    ```
1. 시스템에서 `/mnt/oldhome`을 마운트 해제합니다.
    ```shell
    umount /mnt/oldhome
    ```
1. `rl-home`을 제거하고 `rl-root`를 확장합니다.
    ```shell
    lvremove /dev/mapper/rl-home
    lvextend -l +100%FREE /dev/mapper/rl-root
    ```
1. 결과를 확인합니다.
    ```shell
    mount | grep rl-root
    ```
1. XFS 확장을 수행합니다.
    ```shell
    xfs_growfs /dev/mapper/rl-root
    ```

## 에필로그
운영체제 제작 입장에서는 시스템과 사용자 데이터의 분리가 올바른 방향인 것은 사실입니다. 그러한 관계로 이 속성을 기본으로 제공하는 것 같기도 합니다. 
그렇다면, `/`와 `/home` 영역의 저장 공간을 적절히 분배하는 것이 필요한데, 고민하다보면 영역별로 저장 공간을 정의할 필요가 없는 다른 파일 시스템으로 도피하고 싶어질 때도 많습니다.
