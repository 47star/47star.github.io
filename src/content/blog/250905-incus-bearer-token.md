---
icon: "📦"
title: "Incus Bearer JWT 토큰 생성"
description: "Incus에서 HTTP Authorization 헤더를 위한 Bearer JWT 토큰 생성 방법"
pubDate: "2025-09-05T14:10:00+09:00"
---

Incus에서는 기본적으로 TLS 클라이언트 인증서를 통하여 신원을 확인합니다. 
원본 시스템 자체의 설계 철학을 따르는 것이 맞지만 HTTP Authorization 헤더에 Bearer JWT 토큰을 사용하는 범용적인 방법이 더 편리할 때도 있습니다. 
이렇게 하려는 경우 Incus 서버가 신뢰하는 인증서를 JWT로 변환해서 사용해야 합니다.

1. SSL 인증서 생성
    ```shell
    openssl req -x509 -newkey rsa:4096 -sha384 \
        -keyout incus-api.key \
        -nodes \
        -out incus-api.crt \
        -days 365 \
        -subj "/CN=donghoon.net"
    ```
1. Incus 서버에 인증서 신뢰 추가
    ```shell
    incus config trust add-certificate ./incus-api.crt
    ```
1. tls2jwt[^tls2jwt]를 통하여 JWT 토큰 생성
    이때 마지막 인자는 명령 시점으로부터 유효하도록 할지 결정하는 NotAfter 값입니다. 단위는 초입니다.
    ```shell
    go install github.com/lxc/incus/v6/test/tls2jwt@latest
    tls2jwt incus-api.crt incus-api.key now 300
    ```
1. 테스트
    ```shell
    curl -k -X GET https://127.0.0.1:8443/1.0/instances \
        -H "Authorization: Bearer <Token>"
    ```

## tls2jwt
Incus는 SSL 인증서의 fingerprint, 만료 시간, 발행 시간을 서명한 토큰을 허용합니다. 여기에서 사용한 tls2jwt 명령줄 도구는 이 토큰의 생성 기능을 제공합니다. 이 도구는 토큰 서명에 포함할 발행 시간, 만료 시간을 결정할 수 있습니다. 여기에서 만료 시간은 인증서의 유효 기한과 독립적으로 작동합니다. 인증 주체(subject)의 실질적 만료 시점은 토큰 만료 시간 또는 인증서 유효 기한 중 일찍 도래하는 것에 따릅니다.

## 마치며
Incus에서는 OIDC를 사용하지 않으면 기본적으로 PKI 인증 방식을 사용합니다. TLS 수준에서 인증이 완료되는 덕분에, Incus UI를 사용하는 동안 HTTP 패킷 내에 어떠한 인증 요소도 오가지 않는 진귀함을 볼 수 있습니다. 인증서 재조합을 수반하는 역방향 프록시를 사용한다면 조금 불편할 수는 있겠네요.


---

[^tls2jwt]: [incus/test/tls2jwt/tls2jwt.go](https://github.com/lxc/incus/blob/v6.16.0/test/tls2jwt/tls2jwt.go)