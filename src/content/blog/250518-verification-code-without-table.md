---
icon: "✳️"
title: "데이터베이스 없이 인증 코드 검증"
description: "데이터베이스 테이블을 두지 않고 인증 코드를 검증하는 방법"
pubDate: "2025-05-18T13:18:00+09:00"
---

## 프롤로그
API 백엔드 서버에서 회원 시스템을 운영하는 경우, 대부분 이메일과 전화번호 인증 과정을 구현하게 됩니다. 
이 글에서는 데이터베이스 테이블 없는 인증 코드 검증 방법을 설명합니다.  

## 데이터베이스 기반 인증 코드 시스템
인증 코드는 회원 가입 시 사용자가 입력한 이메일이나 전화번호가 실제로 본인의 것인지 확인하기 위해 사용됩니다. 일반적으로 구현 흐름은 아래와 같습니다.
1. API 서버는 가입 요청에 대해 인증 코드를 랜덤 생성합니다.
2. API 서버는 랜덤 생성된 코드를 데이터베이스 테이블에 입력합니다.
3. API 서버는 랜덤 생성된 코드를 이메일로 발송합니다.
4. 사용자는 자신의 받은 메일함에서 인증 코드를 확인하고 웹사이트에 입력합니다.
5. API 서버는 사용자가 입력한 인증 코드가 데이터베이스에 있는 것과 일치하는지 확인합니다.

일반적으로 인증 코드 저장에는 아래와 같은 테이블이 사용됩니다.
|id|email|verification_code|created_at|
|---|---|---|---|
|367e9f13-cd68-4e90-81a6-2fd4ca1bd978|user1@sample.internal|102842|2025-05-18T03:18:29.000Z|
|fdb66d77-7ccb-474c-b55e-ee5979e9a188|user2@sample.internal|492855|2025-05-18T04:10:31.000Z|
|c09f7a75-bcaf-4f5d-bb61-3f7ed443bbb1|user3@sample.internal|001932|2025-05-18T02:40:12.000Z|
|...|...|...|...|

### 문제점
* **만료된 인증 코드 정리 작업이 필요합니다.** 주기적으로 인증 코드 테이블을 정리해야 합니다. 이 작업을 위한 별도의 배치나 서비스가 필요합니다.
* **입력 값 위•변조 방지 처리가 필요합니다.** 입력 필드의 수정을 차단하는 프론트엔드 수준의 제약은 물론, 백엔드 수준에서도 입력 값이 변조된 것은 아닌지 검증해야 합니다. 이를 위해서 사용자가 인증 이전에 입력했던 값을 저장하는 테이블을 추가로 생성하고, 인증이 성공되면 이 테이블의 레코드와 대조하거나 실제 계정 테이블로 이전하는 로직이 필요할 수 있습니다.
* **구조적 복잡성이 증가합니다.** 테이블이 하나 더 늘어난다는 사실 자체는 부담이 아니지만, 전체 구조는 복잡해질 수 있습니다.

## 데이터베이스 없는 인증 코드 시스템
### 아이디어
IPsec Framework의 AH(Authentication Header)나 JWT(JSON Web Token)의 구현은 무결성 보장을 위해 페이로드에 대한 시그니처를 두는 구조입니다. 
여기에서 아이디어를 얻어 사용자가 회원 가입 필드에 입력한 모든 내용을 직렬화한 것에 서버만 가지고 있는 `secret` 값을 더하여 해시 연산하는 방법으로 인증 코드를 생성할 수 있다고 생각했습니다. 즉, 인증 코드를 데이터베이스에 저장하지 않고도 사용자의 입력 값과 같은 조건에서 항상 동일한 코드를 재현해 낼 수 있기 때문에, 데이터베이스 없이도 검증이 가능합니다.

### 처리 흐름
1. 가입 양식 제출(1차): 사용자가 이메일, 전화번호 등 가입 정보를 서버에 제출합니다.
2. 인증 코드 생성:
    * 서버는 사용자 입력 값과 `secret`, 그리고 현재 시간 정보를 결합하여 인증 코드를 생성합니다.
    * 코드를 이메일이나 문자 메시지로 사용자에게 전달합니다.
3. 인증 코드 검증:
    * 사용자는 전달받은 인증 코드를 다시 웹사이트에 입력합니다.
    * 서버는 동일한 입력 값과 유효한 시간 범위 내에서 가능한 인증 코드를 모두 재생성하고, 입력 값과 비교합니다.

### 인증 유효 시간 관리
해시는 일방향 함수이므로 생성 시점의 시간을 넣어도 역산이 불가능합니다. 이를 해결하기 위해 다음과 같은 방식으로 인증 코드를 시간에 따라 다르게 만듭니다.
* 단위 시간 문자열(예: `20250518_1259`)을 해시 인자에 포함시킵니다.
* 검증 시점에서 허용된 유효 시간(예: 3분) 내의 가능한 모든 단위 시간 문자열을 반복적으로 사용해 인증 코드를 재생성합니다.
* 입력된 코드와 일치하는 것이 하나라도 있다면 인증을 성공한 것으로 간주합니다.

### 의사 코드
#### 인증 코드 생성
```
function GenerateVerificationCode(userInput, secret, timeUnit):
    # userInput: 사용자가 입력한 값 (이메일, 전화번호 등)을 직렬화한 문자열
    # secret: 서버만 알고 있는 비밀 키
    # timeUnit: 현재 시간 단위를 포맷팅한 문자열 (예: "20250518_1259")

    payload = userInput + timeUnit + secret
    hash = SHA256(payload)
    
    # 인증 코드는 해시에서 앞의 일정 길이만 사용
    verificationCode = FirstNDigitsFromHash(hash, 6)
    return verificationCode
```
#### 인증 코드 검증
```
function VerifyVerificationCode(userInput, secret, currentTime, validMinutes, userSubmittedCode):
    # currentTime: 현재 시간
    # validMinutes: 허용된 인증 코드 유효 시간 (예: 3분)
    # userSubmittedCode: 사용자가 입력한 인증 코드

    timeUnits = []
    for delta in range(0, validMinutes + 1):
        t = currentTime - delta minutes
        timeUnits.append(FormatTimeUnit(t))  # 예: "20250518_1259"

    for timeUnit in timeUnits:
        expectedCode = GenerateVerificationCode(userInput, secret, timeUnit)
        if expectedCode == userSubmittedCode:
            return true

    return false
```
#### 해시 함수에서 인증 코드 생성
```
function FirstNDigitsFromHash(hash, n):
    # hash: SHA256 등의 해시 출력 (hex 문자열 또는 바이트 배열)
    # n: 인증 코드 자릿수

    # 해시 결과를 정수로 변환
    hashInt = ConvertHexToInteger(hash)

    # 숫자형 인증 코드 생성
    code = hashInt mod (10^n)

    # 앞자리에 0이 붙도록 zero-padding
    return ZeroPad(code, n)
```

### 잠재적 문제점과 대책
* **브루트포스 시도에 취약할 수 있습니다.** CAPTCHA, API Rate Limit 등의 보안 조치를 함께 사용해야 합니다. 또한, 인증 코드의 길이는 길면 길 수록 좋습니다. (Microsoft 계정 인증 코드의 길이가 8자리이던데, 비슷한 구현이 있는 것인지 그 이유가 궁금해지네요.)
* **같은 단위 시간 내에서 같은 입력 값에 의해 생성된 인증 코드는 서로 동일합니다.** 해시의 인자는 입력 값과 단위 시간입니다. 따라서 이 인자 값들이 모두 동일한 요청에 대해서는 같은 인증 코드가 생성될 수 밖에 없습니다. 일반적인 사용자가 이 현상을 겪을 일은 드물 것으로 생각되나, 이를 방지하기 위해 단위 시간을 줄일 수 있습니다. 대신 검증 해시를 더 많이 생성해야 하므로 일시적으로 API 서버의 컴퓨팅 소모가 적게나마 증가할 수 있습니다. 다만, 암호 해시에 자주 사용되는 PBKDF2[^iteration-count] 등의 동작을 생각하면 이것은 거의 부담이 아닐 수 있습니다.
* **동일한 가입 양식을 서버에 두 번 제출해야 합니다.** 가입 양식은 인증 코드 생성의 인자가 되므로 인증 코드 생성 시 1회, 최종 검증 및 가입 시 1회, 동일한 가입 양식을 서버에 총 2회나 제출해야 합니다. 가입 양식이 매우 복잡하고 용량이 큰 경우, 검증이 필요하지 않은 일부 양식 항목은 인증 코드 생성에서 제외할 수 있습니다.

---

[^iteration-count]: [RFC 2898, PKCS #5: Password-Based Cryptography Specification Version 2.0, 4.2. Iteration count](https://datatracker.ietf.org/doc/html/rfc2898#section-4.2), PBKDF2는 iteration count에 따라서는 수십만 번에 이르는 해시 연산을 수행합니다.