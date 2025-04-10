---
icon: "⚛️"
title: "Kotlin Symbol Processing 소개 및 사용 사례"
description: "KSP로 코드를 자동 생성하여 보일러플레이트 코드 제거하기"
pubDate: "2022-11-10T10:00:00.322Z"
---

## 프롤로그

코드의 양이 방대한 프로젝트에서는 로직이 유사한 보일러플레이트 코드가 곳곳에 생기기 마련입니다.
보일러플레이트 코드는 유지보수 용이성에 악영향을 미칠 가능성이 높아서 최대한 제거 및 통합해 나가는 것이 좋습니다.

대부분의 상황에서는 함수를 정의하여 문제를 해결해왔을 것입니다. JetBrains와 Google에서 Kotlin 대상으로 제공하는
Kotlin Symbol Processing(이하 'KSP')을 사용하면 기존의 방법보다 더 공격적으로 보일러플레이트 코드를 통합할 수 있습니다.

## Kotlin Symbol Processing

Kotlin 컴파일러 플러그인은 Kotlin 프로젝트에서 메타프로그래밍을 실현하는 좋은 방법입니다. KSP는 컴파일러 API에 접근할 수 있게
하는 가볍고 배우기 쉬운 API입니다. 컴파일러 플러그인를 개발함으로써 컴파일 과정에 개입하여 보일러플레이트 코드를 자동 생성하는 등
개발에서의 지루하고 반복된 과정들을 혁신시킬 수 있습니다.

컴파일러를 제어하는 작업은 컴파일러 사소한 변화 등에 영향을 받기에 컴파일러 배경 지식을 숙지해야 할 것을 요구합니다.
KSP는 컴파일러 변화 등에 영향을 받지 않게 만든 컴파일러 API이기 때문에 유지보수 비용을 최소화하면서 메타프로그래밍을 실현할 수 있게 합니다.
또한 KSP는 기존에 런타임 수준에서 메타프로그래밍을 위해 사용하던 Kotlin Reflection API와 유사하여 쉽게 적응할 수 있습니다.

KSP는 Kotlin만을 위한 컴파일러 플러그인 API입니다. 그렇기 때문에 Kotlin에만 존재하는 Extension Function/Variable,
Declaration-site variance이나 Local Function과 같은 기능을 완전하게 지원합니다.

KSP는 Gradle Task로 등록되어 있습니다. task를 실행하면 정해진 로직에 따라 코드를 분석합니다. 그런 다음 정해진 로직에 따라
새로운 코드를 생성하거나 기타 산출물을 생성시킬 수 있습니다. 몇 가지 대표 사용 사례에 대해서는 아래에서 추가로 설명합니다.

KSP의 기능은 선언 정보만 읽어서 새로운 요소를 구현하거나 기타 산출물을 생성하는 작업에 한정됩니다. 파일, 클래스, 변수, 함수 등
요소의 선언 정보만 제공합니다. 함수 내부의 로직과 같은 expression 수준의 정보는 제공하지 않습니다. 또한 기존 선언된 요소를
변경하거나 제거할 수도 없습니다. 만약 이러한 복잡성 있는 작업이 필요하다면 컴파일러 플러그인을 직접 구현하는 것이 좋습니다.

KSP는 코드를 생성하는 API를 포함하지 않습니다. 코드를 수정하고 생성하는 완전한 API가 필요한 경우에도 컴파일러 플러그인을 직접
구현하는 것이 적합합니다. 대신, 코드를 문자열로 일일이 작성하는 작업을 돕는 KotlinPoet 라이브러리를 사용할 수 있습니다.

### KSP 플러그인을 프로젝트에 등록하는 방법

KSP 플러그인의 구조를 설명하기 전에 KSP 플러그인이 프로젝트에 등록되는 방법을 간단히 살펴보겠습니다.

KSP는 일종의 컴파일러 플러그인이지만 Gradle 플러그인을 등록하는 형식으로 사용하지 않습니다. 대신 KSP Gradle 플러그인만을 등록한 다음
일반적으로 의존성 모듈을 정의하는 경험과 같이 `ksp`라는 함수를 사용하여 KSP 플러그인을 추가하면 됩니다.

```kotlin
// build.gradle.kts
plugins {
    kotlin("jvm") version "1.7.21"
    // KSP Gradle 플러그인 추가
    id("com.google.devtools.ksp") version "1.7.21-1.0.8"
}

// ...

dependencies {
    // ...
    // KSP 플러그인 추가
    ksp(project(":compiler-plugin"))
}
```

### KSP 플러그인의 구조

KSP 플러그인은 코드 분석 및 처리 로직을 포함한 `SymbolProcessor`와 `SymbolProcessor`를 공급하는
`SymbolProcessorProvider`를 근간으로 구성됩니다. KSP Gradle 플러그인이 로드되면 KSP Gradle
플러그인이 로드되면 `ksp` 함수로 입력 받은 KSP 플러그인을 전부 불러옵니다. KSP 플러그인은
`SymbolProcessorProvider`를 [ServiceLoader](https://docs.oracle.com/javase/9/docs/api/java/util/ServiceLoader.html)
를 통해 모두 탐색하여 실행합니다. 그런 다음 `SymbolProcessorProvider`는 `SymbolProessor`를 호출합니다.

`SymbolProcessor`에서 `Resolver`를 통해 소스셋에 있는 Kotlin 코드를 탐색하고 선언 정보를 얻을 수 있습니다.
그런 다음 얻은 정보를 기반으로 코드를 생성하거나 기타 산출물을 생성할 수 있습니다.

## 사용 사례

사용 사례를 통해 KSP를 어떻게 활용할 수 있는지 살펴보겠습니다.

### Polymorphic Kotlin Serialization

Kotlin Serialization에서는 `sealed` 키워드를 클래스에 부여하여 다형성 모델을 취급할 수 있습니다.
`sealed` 키워드는 동일 패키지에 한정하여 사용할 수 있는데 다형성 모델을 여러 패키지 경로에 걸쳐 구현하고자
하는 상황이 있을 수 있습니다. `selaed` 키워드 대신 클래스 또는 인터페이스를 상속 시킨 다음 수동으로 모든
자식 클래스를 Polymorphic Serializer에 정의해야 하는 불편이 발생합니다. 이 상황에서 KSP를 활용하면 특정한
클래스 또는 인터페이스로부터 상속 받은 클래스를 추적하여 Polymorphic Serializer를 자동 생성할 수 있습니다.

### Reflection on Kotlin/JS

Kotlin/JS에서는 제한된 Reflection 기능만 사용 가능합니다. KSP를 통해 Reflection의 추가 기능을 구현하는 등
Kotlin/JS에서도 메타프로그래밍을 실현할 수 있습니다.

## 에필로그

메타프로그래밍을 통해 반복된 코드의 작성과 불필요한 작업을 최소화하는 것은 분명히 좋은 일입니다. 그렇지만 메타프로그래밍 없이
문제를 해결하는 방법을 먼저 깊이 고민해보고 불가피한 상황에 한정적으로 활용하는 것을 권장하고 싶습니다. 저는 개인적으로
메타프로그래밍 과의존은 바람직하지 않다고 생각합니다.

## 레퍼런스

- [Kotlin Symbol Processing API - Kotlin Docs](https://kotlinlang.org/docs/ksp-overview.html)
- [Kotlin Symbol Proessing Gradle Plugin](https://search.maven.org/artifact/com.google.devtools.ksp/symbol-processing-gradle-plugin)
- [donghoon-yoo/kotin-symbol-processing-practice](https://github.com/donghoon-yoo/kotlin-symbol-processing-practice)
- [JetBrains/kotlin](https://github.com/JetBrains/kotlin/tree/master/plugins)
- [kotlinpoet](https://square.github.io/kotlinpoet/)
