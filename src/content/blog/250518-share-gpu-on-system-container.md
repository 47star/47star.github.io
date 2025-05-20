---
icon: "🐧"
title: "시스템 컨테이너에서 NVIDIA GPU 공유"
description: "시스템 컨테이너(LXC)에서 NVIDIA GPU 자원을 공유하는 방법"
pubDate: "2025-05-17T21:33:00+09:00"
---

## 프롤로그
시스템 컨테이너[^LXC]를 사용하는 환경에서 NVIDIA GPU 자원을 공유하는 방법을 정리했습니다. 
여기에서 설명하는 시스템 컨테이너는 애플리케이션 컨테이너가 아닙니다.

## 주의사항
* 설치 과정에서 시스템을 다시 시작해야 할 수 있습니다.
* 설치 과정에서 GPU를 사용하는 프로세스를 모두 종료해야 합니다.
* 컨테이너 특성으로 AppArmor, SELinux를 사용하기 어려울 수 있습니다. Linux 보안 기능이므로 비활성화에 주의가 필요합니다.
* 부트로더 속성을 변경해야할 수 있습니다. 특수한 환경에서는 시스템이 부팅되지 않을 수 있습니다.
* 모든 그래픽 드라이버를 다시 설치하는 과정이 포함되어 있습니다.

## 구성 환경
제가 구성한 호스트 환경은 다음과 같습니다.
* 하드웨어: NVIDIA DGX Station[^DGX]
* 운영체제: NVIDIA DGX OS 6(Ubuntu 22.04 LTS 기반)[^DGX-OS]

## 호스트 구성
### AppArmor 비활성화
원활한 시스템 컨테이너 사용을 위하여 AppArmor를 비활성화합니다. 비활성화한 이후에는 시스템을 다시 시작해야 합니다. GRUB 부트로더 파라미터를 변경하는 것입니다. 특수한 환경에서는 시스템이 부팅되지 않을 수 있으므로 주의가 필요합니다.

```shell
sed -i 's/^GRUB_CMDLINE_LINUX=""/GRUB_CMDLINE_LINUX="apparmor=0"/' /etc/default/grub
update-grub
```

### 드라이버 재설치
호스트와 컨테이너의 버전 일관성을 보장하기 위하여 NVIDIA 관련 패키지를 전부 제거하고 패키지가 남아있는지 확인합니다.
```shell
apt purge nvidia* libnvidia* linux-modules-nvidia* linux-nvidia*
apt list --installed | grep nvidia
```

NVIDIA 드라이버 설치를 위해 `kmod`와 `build-essential`을 설치합니다.
```shell
apt-get install kmod build-essential
```

이제 NVIDIA 공식 웹사이트에서 NVIDIA 드라이버, CUDA Toolkit을 다시 설치할 것입니다. 아래에서 받은 각 항목의 확장자는 `.run`이어야 합니다. 버전 선택에는 [CUDA Compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/)를 참고하세요.
* [NVIDIA Manual Driver Search](https://www.nvidia.com/en-us/drivers/)에서 GPU 모델에 맞는 드라이버를 찾습니다. 그런 다음, Linux 64-bit와 적절한 CUDA 버전을 선택합니다. 언어는 영어를 선택하는 것을 권장합니다.
* [NVIDIA CUDA Toolkit Archive](https://developer.nvidia.com/cuda-toolkit-archive)에서 GPU 드라이버에 맞는 CUDA Toolkit 버전을 찾습니다. 그런 다음 운영체제로 Linux, 아키텍처로 x86_64, Distribution으로 Debian, 설치 유형으로 runfile (local)을 선택합니다.

(예시)내려 받은 파일의 이름 형식은 아래와 같습니다.
* `NVIDIA-Linux-x86_64-570.133.20.run`
* `cuda_12.8.1_570.124.06_linux.run`

아래 명령어에 따라 실행 권한을 부여하고 설치합니다.
```shell
chmod +x ./NVIDIA-Linux-x86_64-570.133.20.run
./NVIDIA-Linux-x86_64-570.133.20.run --silent

chmod +x ./cuda_12.8.1_570.124.06_linux.run
./cuda_12.8.1_570.124.06_linux.run --silent --toolkit
```

이로써 NVIDIA 드라이버, CUDA Toolkit, NVCC 설치가 완료됩니다. `nvidia-smi` 명령으로 GPU 상태를 확인하세요.

## 컨테이너 구성
컨테이너는 다음의 옵션을 포함해야 합니다. GPU가 여러 개인 경우 필요한 만큼 정의해도 됩니다.
```yaml
devices:
    gpu-1:
        gputype: physical
        pci: '0000:07:00.0'
        type: gpu
    gpu-2:
        gputype: physical
        pci: '0000:08:00.0'
        type: gpu
    # ...
config:
    security.privileged: 'true'
    security.nesting: 'true'
```

호스트에서 드라이버 설치 시 받은 파일을 그대로 사용합니다. 단, 드라이버 설치 옵션에 `--no-kernel-module`을 포함시켜야 합니다. 컨테이너에서는 커널 모듈을 수정할 수 없으며, 호스트의 드라이버 커널 모듈을 참조해야 합니다.
```shell
chmod +x ./NVIDIA-Linux-x86_64-570.133.20.run
./NVIDIA-Linux-x86_64-570.133.20.run --silent --no-kernel-module

chmod +x ./cuda_12.8.1_570.124.06_linux.run
./cuda_12.8.1_570.124.06_linux.run --silent --toolkit
```

호스트와 마찬가지로 `nvidia-smi` 명령으로 GPU 상태를 확인할 수 있습니다.

추가로, 딥러닝을 위한 환경의 경우 cuDNN[^cuDNN]을 설치하면 됩니다. [cuDNN Archive](https://developer.nvidia.com/cudnn-archive)에서 적절한 버전을 찾고 아래와 같이 옵션을 선택하면 됩니다. 그런 다음 안내되는 명령줄을 실행하면 설치할 수 있습니다. CUDA와 cuDNN 버전 호환성은 [NVIDIA cuDNN Backend Support Matrix](https://docs.nvidia.com/deeplearning/cudnn/backend/latest/reference/support-matrix.html)를 참고하세요.
* Operating System: Linux
* Architecture: x86_64
* Distribution: Debian
* Version: 12
* Installer Type: deb (local)

설치가 완료되면 아래 명령줄로 cuDNN 버전을 검증할 수 있습니다.

```shell
cat /usr/include/x86_64-linux-gnu/cudnn_v*.h | grep CUDNN_MAJOR -A 2
```

## 스크립트(예시)
드라이버가 모두 제거된 상황을 가정하면 호스트와 컨테이너에서 각각 다음과 같은 스크립트를 사용할 수 있습니다. Linux x86_64 환경의 NVIDIA DGX Station을 위한 예시입니다.
* NVIDIA Driver 570.133.20
* CUDA Toolkit 12.8
* cuDNN 9.10.0

**호환성 확인 없이는 절대 실행하지 마십시오.**
```shell
# 호스트
curl -O https://us.download.nvidia.com/tesla/570.133.20/NVIDIA-Linux-x86_64-570.133.20.run
curl -O https://developer.download.nvidia.com/compute/cuda/12.8.0/local_installers/cuda_12.8.0_570.86.10_linux.run

chmod +x ./*.run
./NVIDIA-Linux-x86_64-570.133.20.run --silent
./cuda_12.8.0_570.86.10_linux.run --silent --toolkit

nvidia-smi
```
```shell
# 컨테이너
curl -O https://us.download.nvidia.com/tesla/570.133.20/NVIDIA-Linux-x86_64-570.133.20.run
curl -O https://developer.download.nvidia.com/compute/cuda/12.8.0/local_installers/cuda_12.8.0_570.86.10_linux.run
curl -O https://developer.download.nvidia.com/compute/cudnn/9.10.0/local_installers/cudnn-local-repo-debian12-9.10.0_1.0-1_amd64.deb

chmod +x ./*.run
./NVIDIA-Linux-x86_64-570.133.20.run --silent --no-kernel-module
./cuda_12.8.0_570.86.10_linux.run --silent --toolkit

dpkg -i cudnn-local-repo-debian12-9.10.0_1.0-1_amd64.deb
cp /var/cudnn-local-repo-debian12-9.10.0/cudnn-*-keyring.gpg /usr/share/keyrings/
apt-get update -y
apt-get install -y cudnn

nvidia-smi
```

---

[^LXC]: System Container, [linuxcontainers.org](https://linuxcontainers.org)
[^DGX]: [NVIDIA DGX Station](https://www.nvidia.com/en-us/products/workstations/dgx-station/)
[^DGX-OS]: [NVIDIA DGX OS 6](https://docs.nvidia.com/dgx/dgx-os-6-user-guide/index.html)
[^cuDNN]: [NVIDIA CUDA® Deep Neural Network library (cuDNN)](https://developer.nvidia.com/cudnn)