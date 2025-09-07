---
icon: "📦"
title: "Incus /exec API 동작 정리"
description: "Incus exec API의 알 수 없는 동작 방식을 정리했습니다."
pubDate: "2025-09-06T18:27:00+09:00"
---

Incus에는 Incus Agent에 기반하여 게스트 시스템에서 명령을 수행하는 편리한 기능이 있습니다. 문서화가 덜 되어 있는 이유로 API로 사용하면 복잡하게 느껴질 수 있습니다.

## 동작 설명
1. `/1.0/instances/{instance}/exec` 요청에 대한 응답의 `metadata.metadata.fds`에서 stdin, stdout, stderr, control(창 크기 변경 등에 사용) 스트림 ID를 확인합니다.
2. 웹 소켓을 통하여 각 스트림 ID(file descriptor)에 대하여 `/1.0/operation/{operation}/websocket?secret={fd}`에 연결합니다.  
    * fd 값에 대한 키가 `secret`이지만 TLS 인증은 제공되어야 합니다
    * stderr 등 비즈니스 로직에서 필요하지 않는 채널이라고 하더라도 모두 연결되어야 정상 동작합니다.

이 외에 단순히 명령을 제공하고 수행이 완료되면 결과를 응답 받는 방법은 없습니다.

## 참고 코드
한글(CP949) Windows에 대한 비대화형 명령을 수행한 다음 결과를 받아오는 코드는 다음과 같습니다.

```python
@dataclass
class IncusExecMetadata:
    fds: dict[str, str]

@dataclass
class IncusOperationMetadata:
    metadata: IncusExecMetadata

@dataclass  
class IncusExecResponse:
    operation: str
    metadata: IncusOperationMetadata

# ...

async def consume_websocket_stream(self, url: str, encoding: str) -> list[str]:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    responses = []

    async with websockets.connect(
        uri = url, 
        ssl = ssl_context, 
        additional_headers = self.session.headers,
    ) as websocket:
        try:
            while True:
                response = await websocket.recv(False)
                responses.append(response.decode(encoding))
        except websockets.exceptions.ConnectionClosedError:
            pass

    return responses

async def execute(self, instance: str, command: list[str], encoding: str = "euc-kr") -> list[str]:
    response = self.session.post(
        url = f"https://{self.config.host}/1.0/instances/{instance}/exec?project={self.config.project}&wait=10", 
        verify = False,
        json = {
            "command": command,
            "wait-for-websocket": True,
            "interactive": False,
            "width": 1000,
            "height": 1000,
        },
    )
    if not response.ok:
        raise Exception("Unable to execute on instance.")
    
    exec_response = dacite.from_dict(IncusExecResponse, response.json())
    fds = exec_response.metadata.metadata.fds
    
    stream = await asyncio.gather(*[
        self.consume_websocket_stream(f"wss://{self.config.host}{exec_response.operation}/websocket?secret={fd}", encoding) 
        for fd in fds.values()
    ])
    
    return stream[1]
```

## 마치며
Incus Main API 문서[^api-docs] JSON 필드에 대한 설명이 보충되어야 할 것입니다.

---

[^api-docs]: [Main API specification](https://linuxcontainers.org/incus/docs/main/rest-api-spec)