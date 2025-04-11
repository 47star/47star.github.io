---
icon: "📦"
title: "Fedora LXC 컨테이너에서 Kubernetes를 위한 커널 로그 디바이스 구성"
description: "Fedora LXC 컨테이너에 Kubernetes의 kubelet의 기능을 위한 커널 로그 가상 디바이스 구성 방법 정리"
pubDate: "2025-04-11T08:10:00.000Z"
---

## 프롤로그
기본적으로 컴퓨터나 서버는 하나의 역할만 하는 것이 좋기는 하지만 그럴 여건이 안되는 경우에도, 장치를 Kubernetes 노드로 구성하면 다른 작업을 병행하기가 어렵고, 
하나의 장치에 여러 Kubernetes 클러스터를 만들기도 불가능에 가깝습니다. 
그러한 이유로 최근에는 장치를 LXC를 통하여 논리적으로 격리하고, 컨테이너에 워크로드를 구성하는 시도를 지속하고 있습니다.

그 가운데 Fedora LXC 컨테이너에 Kubernetes 설치 시 [`kmsg`](https://www.kernel.org/doc/Documentation/ABI/testing/dev-kmsg) 관련 제약사항을 알아보고, 해결하는 방법을 정리하였습니다.

## 살펴보기
### `kmsg`와 Kubernetes
`kmsg`는 Linux 커널 로그 버퍼입니다. `/dev/kmsg`는 유저 스페이스에서의 `kmsg` 접근을 제공하는 가상 디바이스입니다. 
Kubernetes의 kubelet은 `/dev/kmsg`를 통하여 컨테이너 리소스 관련 정보, 주로 OOM 이벤트를 모니터링합니다.

### LXC와 `console`
LXC는 컨테이너로써 격리되는 속성이 있는 관계로, `/dev/kmsg`에 직접 접근할 수 없습니다. 
[`/dev/console`](https://www.kernel.org/doc/html/latest/admin-guide/serial-console.html)은 시스템 콘솔 가상 디바이스인데 이것이 `/dev/kmsg`의 격리 버전인 것은 아니지만, 적어도 kubelet이 필요로 하는 이벤트 수신 목적은 
대부분 달성할 수 있습니다.

## 구성하기
Fedora LXC 컨테이너에서 다음의 명령을 실행하여 `/dev/kmsg`가 `/dev/console`를 바라보도록 심볼릭 링크를 생성하는 서비스를 구성합니다.
```shell
cat <<EOF | tee /usr/local/bin/kmsg.sh
#!/bin/sh -e
if [ ! -e /dev/kmsg ]; then
  ln -s /dev/console /dev/kmsg
fi
mount --make-rshared /
EOF

cat <<EOF | tee /etc/systemd/system/kmsg.service
[Unit]
Description=Create /dev/kmsg

[Service]
Type=simple
RemainAfterExit=yes
ExecStart=/usr/local/bin/kmsg.sh
TimeoutStartSec=0

[Install]
WantedBy=default.target
EOF

chmod +x /usr/local/bin/kmsg.sh
systemctl daemon-reload
systemctl enable --now kmsg
```
