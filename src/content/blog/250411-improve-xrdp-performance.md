---
icon: "⚡"
title: "느린 XRDP 성능 개선하기"
description: "XRDP 속성 변경으로 느린 XRDP 성능을 개선하는 방법"
pubDate: "2025-04-11T07:46:00.000Z"
---

## 프롤로그
원격 데스크톱 프로토콜로는 Microsoft의 RDP가 가장 우수하다고 생각합니다.(프로토콜과 엔진 잘 만드는 회사) 
그래서 Linux에서도 RDP를 사용하기 위해 XRDP를 사용하는데, 매번 느린 성능으로 고생하곤 합니다. 
Microsoft에서 Hyper-V 게스트 초기화 스크립트에 조용히 넣어둔 몇 줄의 구문을 활용하였습니다.

## 설정 변경
이 과정에서 RDP 암호화를 비활성화합니다. 스니핑 우려가 있는 경우 `none` 대신 `low`로 변경하는 것을 권장합니다.

```shell
sed -i_orig -e 's/security_layer=negotiate/security_layer=rdp/g' /etc/xrdp/xrdp.ini
sed -i_orig -e 's/crypt_level=high/crypt_level=none/g' /etc/xrdp/xrdp.ini
sed -i_orig -e 's/bitmap_compression=true/bitmap_compression=false/g' /etc/xrdp/xrdp.ini
sed -i_orig -e 's/#tcp_send_buffer_bytes=32768/tcp_send_buffer_bytes=4194304/g' /etc/xrdp/xrdp.ini
sed -i_orig -e 's/#max_bpp=32/max_bpp=24/g' /etc/xrdp/xrdp.ini
sed -i_orig -e 's/#xserverbpp=24/xserverbpp=24/g' /etc/xrdp/xrdp.ini
```

XRDP 데몬 또는 시스템을 다시 시작하면 변경 사항이 적용됩니다.

## 에필로그
Cloudflare에서 최근 Rust로 [IronRDP](https://github.com/Devolutions/IronRDP)라는 RDP 구현체를 공개하였습니다. 
이는 벌써부터 성능이 좋다고 알려져 있는데, 빠르게 안정화되어 XRDP를 대체할 수 있으면 좋겠습니다.