---
icon: "📺"
title: "MikroTik, SK Broadband Apple TV IGMP Snooping 구성 방법"
description: "SK Broadband의 Apple TV를 사설 네트워크로 통합하기 위한 IGMP Snooping 구성 방법"
pubDate: "2025-04-11T12:06:00.000Z"
---

## 프롤로그
SK Broadband(이하 'SKB')는 대한민국에서 유일하게 Apple TV를 지원하는 인터넷 서비스 제공자(ISP)입니다. 
SKB는 IGMP + RTSP 기반 IPTV 수신 애플리케이션을 프로파일로 배포하는 방식으로 IPTV 서비스를 제공하고 있습니다.  

Apple TV는 IoT 기기로써 사설 네트워크에 연동되어야 AirPlay 2, HomeKit 등 연속성 기능을 제대로 활용할 수 있습니다. 
IGMP + RTSP 방식을 사설 네트워크에서 바로 사용하는 것은 비효율적인 관계로 대부분은 사설 네트워크 + NAT를 포기하고, 
Apple TV를 스위치에 직접 연결하고 있습니다.  

이 글에서는 SKB의 Apple TV에서 IGMP + RTSP를 원활히 수신할 수 있으면서도 사설 네트워크에 접속할 수 있게 하는 방법을 정리하였습니다.

## 환경
* 가정용 SKB 인터넷 및 B TV 서비스
* Apple TV(Ethernet)
* MikroTik RouterOS
    ```
    /interface bridge
        add name=bridge-wan
        add name=bridge-lan
    
    /interface bridge port
        add bridge=bridge-wan interface=ether1
        add bridge=bridge-lan interface=ether2
        add bridge=bridge-lan interface=ether3
        add bridge=bridge-lan interface=ether...
    ```

## 발생 가능한 문제점들
### 인터넷 스위치와 직접 연결한 경우
* Apple TV가 사설 네트워크에 연결되지 못하여 발생 가능한 모든 문제점:
    * HomeKit의 모든 기능 이용 불가
    * AirPlay 2 이용 불가

### 사설 네트워크에 연결한 경우
* IPTV 수신 불가
* IPTV 주기적 끊김
* IPTV 채널 전환 시 끊김

## IGMP 구성
* LAN용 Bridge에 IGMP Snooping, Multicast Querier 활성화
* IGMP Proxy 활성화, Query Interval, Query Response Interval 설정
* **IGMP Proxy 인터페이스 구성**: SKB의 RTSP 서버는 `192.168.0.0/16` 내에 있습니다.
* **Connection tracking에서 UDP timeout 상향**: 기본 UDP timeout 값이 매우 짧게 되어있는 관계로 MikroTik Router에서 외부와 Apple TV 사이의 RTSP 커넥션을 메모리에 계속 유지하지 못합니다. 이를 설정하지 않으면 IPTV 연결이 끊어집니다.

```
/interface bridge
    add igmp-snooping=yes multicast-querier=yes name=bridge-lan

/routing igmp-proxy
    set query-interval=2m30s query-response-interval=1s

/routing igmp-proxy interface
    add alternative-subnets=192.168.0.0/16 interface=bridge-wan upstream=yes
    add interface=bridge-lan

/ip firewall connection tracking
    set udp-stream-timeout=15m udp-timeout=5m
```

## 특이사항
SKB에서 기본 제공하는 라우터를 사용하는 경우 Apple TV를 직접 연결하지 않고 라우터를 중간에 두면 IPTV가 끊어졌었습니다. 
NAT 모드, bridge 모드 등 기본 라우터의 설정과 관계 없이 일어나는 문제였습니다. 기본 스위치를 교체해야 했습니다. 
만약 기가라이트[^기가라이트] 서비스 지역에 해당하는 경우, ipTIME H6005-IGMP 또는 H6008-IGMP를 사용해야 합니다.

## 에필로그
IGMP + RTSP 방식은 구성이 까다로우나 ISP 입장에서 꼭 필요한 구성인 것은 맞습니다. 
다만, 이를 제대로 구성했음에도 기본 라우터 교체 전까지 알 수 없는 이유로 끊김이 발생했었는데, 
기본 라우터의 성능 또는 구현 문제는 개선되어야 할 필요성이 분명하다고 생각됩니다.

[^기가라이트]: UTP Cat.5 케이블로 500Mbps 서비스하기 위한 SKB의 비표준 이더넷 연결