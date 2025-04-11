---
icon: "🌐"
title: "VXLAN Double Fragmentation 및 패킷 손실 문제 해결"
description: "VXLAN 환경에서 패킷 이중 파편화 문제를 살펴보고 문제를 해결합니다."
pubDate: "2025-04-11T12:30:00.000Z"
---

## 프롤로그
VXLAN[^VXLAN]은 소프트웨어 중심 인프라에서 네트워크 운영의 유연성을 향상시키는데 도움이 될 수 있는 프로토콜입니다. 
VXLAN 프로토콜은 Cilium이나 Calico 등의 우수한 오픈소스와 함께 Kubernetes를 포함한 많은 영역에서 활용되어지고 있습니다.  

이 글에서는 VXLAN의 Double Fragmentation 문제와 패킷 손실 문제 해결 방법을 설명합니다.

## 문제 설명
### VXLAN
기능적 측면에서 VXLAN 프로토콜은 Ethernet[^IEEE-802.3] 프로토콜과 같은 Layer 2(이하 'L2') 프레임을 적재합니다. 
이 프로토콜을 활용하면 원거리에 위치하는 등의 이유로 L2 수준 연동이 곤란한 지역 사이에서 L2 영역을 연동할 수 있습니다. 
간혹 L2 수준 연동을 요구하는 네트워크 토폴로지에서 이러한 목적을 달성하는데 도움이 될 수 있습니다.  

VXLAN은 UDP 이하에서 사용하도록 제안된 프로토콜입니다. 
네트워크는 표준에 기반하여 각 제조사가 구현하는 것으로써 모든 기능이 일관되게 구현되어 있지 않을 수 있으며 라우팅, 방화벽, NAT에서 예상하지 못한 문제로 연결될 수 있습니다. 
이러한 이유로 네트워크가 정착된 이후인 비교적 최근에 제안된 프로토콜은 새로운 L3 프로토콜 대신 UDP 이하에서 동작하는 것으로 정의되는 추세입니다. 
참고로 최근 HTTP/3로 이름을 알리고 있는 QUIC 프로토콜이 유사한 경우입니다.  

상기와 같은 프로토콜의 특성에 따라 물리적 연결 대신 VXLAN을 통하여 L2 프레임을 전송하는데는 더 긴 헤더가 사용됩니다. 
Ethernet - IP - UDP - VXLAN - Original L2 Frame의 구조로써 VXLAN을 사용하면 그렇지 않았을 때보다 최소 50 Bytes가 더 사용됩니다. 

### MTU와 VXLAN 오버헤드
IEEE 802.3 Ethernet Standard에 따라 이더넷 인터페이스 수준에서 이더넷 프레임의 maximum transmission unit(이하 'MTU')을 제한하고 있습니다. 
VXLAN이 VXLAN 소프트웨어 처리를 포함하는 가상 인터페이스에 기반하여 동작하므로 VXLAN에 적재될 원본 L2 프레임은 MTU의 적용 대상입니다. 
원본 L2 프레임을 캡슐화한 VXLAN 프레임 또한 물리적 인터페이스를 경유하는 과정에서 MTU가 적용됩니다. 
즉, MTU 제한은 원본 L2 프레임과 VXLAN 프레임에 각각 적용될 소지가 있습니다.  

일반적인 이더넷 네트워크의 기본 MTU는 1,500바이트로 설정되어 있습니다. VXLAN 캡슐화는 약 50바이트의 오버헤드를 추가하므로, 
VXLAN 인터페이스의 유효 MTU는 기본 인터페이스 MTU에서 VXLAN 캡슐화 오버헤드를 뺀 값이 됩니다. 이는 다음 공식으로 계산할 수 있습니다: 
```
VXLAN MTU = 기본 인터페이스 MTU - VXLAN 캡슐화 오버헤드
```

Linux 환경의 모든 설정이 기본인 상태에서 MTU가 각각 적용되는 최악의 상황을 고려해보면, 
기본 MTU 1500바이트에서 VXLAN 오버헤드 50바이트를 뺀 1,450바이트가 실제 사용 가능한 최대 패킷 크기가 됩니다.

### 패킷 손실 문제
RFC 7348에 따르면, VTEP[^VTEP]은 VXLAN 패킷을 분할할 수 없습니다.[^VTEP-Fragmentation] 중간 라우터는 더 큰 프레임 크기로 인해 캡슐화된 
VXLAN 패킷을 분할할 수 있지만, 목적지 VTEP는 이러한 VXLAN 분할본을 제대로 처리하지 못합니다. 즉, 경고 없이 패킷이 손실될 수 있습니다. 

## 문제 해결
### MTU 조정
RFC 7348에 따르면, VXLAN 구간 내에서 MTU를 적절히 조정해야 합니다.[^VXLAN-MTU-Recommendation]  

실제 구현에서는 다음과 같은 MTU 설정이 권장됩니다:
* IPv4 VXLAN을 사용하는 경우: `물리적 네트워크 MTU 크기 - 50`
* IPv6 VXLAN을 사용하는 경우: `물리적 네트워크 MTU 크기 - 70`
* WireGuard 터널링과 함께 IPv4를 사용하는 경우: `물리적 네트워크 MTU 크기 - 60`
* WireGuard 터널링과 함께 IPv6를 사용하는 경우: `물리적 네트워크 MTU 크기 - 80`

### 점보 프레임 활성화
더 효율적인 해결책은 네트워크 전체에서 점보 프레임(Jumbo Frame)을 활성화하는 것입니다. 
점보 프레임은 일반적으로 9,000-9,216바이트 범위의 MTU를 가지며, 고속 네트워크에서 효율성을 향상시킬 수 있습니다.

## 에필로그
프로덕션 수준 운영 환경에서는 본문에서 설명한 것과 같은 사소한 문제가 치명적인 손실로 연결될 가능성이 있습니다. 
다시금 깊이있는 네트워크 지식에 기반한 세심한 구성과 관찰, 그리고 정확한 분석을 통한 문제 해결이 중요하다고 생각되는 계기가 되었습니다.  
  
VXLAN 가상 인터페이스와 직접 접하지 않은 노드에서 추가적인 토폴로지 인지 구현없이 VXLAN Double Fragmentation 문제를 피할 방법이 필요하다고 생각합니다. 
대부분의 커널 네트워킹 스택에 이미 구현되어 있을 기존 표준인 RFC 1191(Path MTU Discovery) 등과 연계할 방법을 고민해 보려고 합니다.

---

[^VXLAN]: [Virtual eXtensible Local Area Network (VXLAN): A Framework for Overlaying Virtualized Layer 2 Networks over Layer 3 Networks](https://datatracker.ietf.org/doc/html/rfc7348)
[^IEEE-802.3]: IEEE 802.3 Ethernet
[^VTEP]: VTEP; VXLAN Tunnel End Point
[^VTEP-Fragmentation]: [4.3. Physical Infrastructure Requirements](https://datatracker.ietf.org/doc/html/rfc7348#section-4.3) — "VTEPs MUST NOT fragment VXLAN packets."
[^VXLAN-MTU-Recommendation]: [4.3. Physical Infrastructure Requirements](https://datatracker.ietf.org/doc/html/rfc7348#section-4.3) — "To ensure end-to-end traffic delivery without fragmentation, it is RECOMMENDED that the MTUs (Maximum Transmission Units) across the physical network infrastructure be set to a value that accommodates the larger frame size due to the encapsulation."