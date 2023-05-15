---
title: "Kotlin Coroutine을 콘텍스트 저장소로 이용하기"
description: "⚛️ Kotlin Coroutine Context를 상속하여 속성을 추가하는 방법과 원리 설명"
date: '2023-05-15T13:36:00.000Z'
tags:
    - Kotlin
    - Coroutines
series: "Kotlin"
---

![](overview.svg)

# 프롤로그

관심사 분리(Separation of Concerns, 이하 'SoC') 디자인 원칙에서는 구성 요소의 개발에 독립성을 부여하려는 성격을 띄는 특성상
구성 요소 간 공통의 데이터를 전달하기 어렵습니다. 그러라고 만들어진 디자인 원칙이니 이해가 되지만, 토큰으로 구한 사용자 정보 같은 공통의 데이터를
공유하지 않는 것은 자원 낭비로 연결되는 관계로 구성 요소 간 공통의 데이터를 공유하고 싶은 경우가 종종 있습니다. 대표적인 백엔드 애플리케이션 프레임워크인
Spring Framework에서는
[`ServletRequest`](https://www.gnu.org/software/classpathx/servletapi/javadoc/javax/servlet/ServletRequest.html)를
이용하여 속성을 취급합니다.

위와 같은 목적을 달성하기 위해, 본 글에서는 Kotlin Coroutine Context의 구조를 활용하여 속성을 추가하는 방법과 원리를 설명하고자 합니다.

# 원리 설명

본 글에서 설명하는 내용의 이해에 필요한 최소한의 원리를 정리하였습니다.

## Coroutine Context는 어떻게 전달될까?

Coroutine에서 실행되어야 하는 함수는 `suspend` 키워드를 포함하여 정의됩니다. 이러한 코드는 Kotlin 컴파일러에 의해 Coroutine Context를
전달할 수 있는 매개변수가 추가된 것으로 컴파일됩니다. 하나의 Coroutine Context에서 호출된 함수들은 모두 같은 메모리를 참조할 수 있게 됩니다.
[kotlin.coroutine.Continuation](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.coroutines/-continuation/#properties)

이 아이디어는 Coroutine Context가 매개변수로 공유된다는 특성에서 출발한다는 점을 강조하고 싶습니다.

![Figure 1: Passed Coroutine Context instance in parameter](1-passed-coroutine-context-instance-in-parameter.svg)

## Coroutine Context 상속하기

Coroutine Context는 아래와 같이 간단히 상속 가능합니다. 속성은 생성자의 매개변수에 정의하면 됩니다.

```kotlin
import kotlin.coroutines.CoroutineContext

data class MyContext(
    val userName: String,
) : CoroutineContext.Element {
    companion object Key : CoroutineContext.Key<MyContext>

    override val key = Key
}
```

### CoroutineContext.Element?

`CoroutineContext` 대신 `CoroutineContext.Element`를 상속한 이유에 대한 설명은 다음과 같습니다. 관심이 없으시다면 무시해도 됩니다.

Coroutine Context는 실행 과정인 `launch`에 의해 `CombinedContext`와 같은 객체로 복제 등 가공됩니다. 즉, 항상 인스턴스를 그대로 유지하지
않습니다. 이렇게 가공된 Coroutine Context 인스턴스에서 원래의 인스턴스를 찾기 위해서는
[`get`](https://github.com/JetBrains/kotlin/blob/c46a95aad7cc179da61a98280d63b952ee8231cb/libraries/stdlib/src/kotlin/coroutines/CoroutineContext.kt#LL18C41-L18C41)
연산자 메소드를 이용해야 합니다. 이 메소드는 `CoroutineContext.Key<CoroutineContext>`가 아닌
`CoroutineContext.Key<CoroutineContext.Element>`만을 매개변수로 취급합니다. 따라서 `CoroutineContext.Element`가 아닌
`CoroutineContext`를 상속하면 `CombinedContext`로부터 원래의 인스턴스를 찾을 수 없게 됩니다.

### 상속한 Coroutine Context에서 Job 실행하기

상속한 Coroutine Context에서 Job을 실행하는 방법은 일반적인 방법과 같습니다. 참고를 위해 코드를 남겨두겠습니다.

```kotlin
import kotlinx.coroutines.CoroutineScope

CoroutineScope(MyContext(userName = "DongHoon")).launch {
    // ...
}

withContext(MyContext(userName = "DongHoon")) {
    // ...
}
```

## Coroutine Context 가져오기

suspend function에서 `coroutineContext` 또는 `currentCoroutineContext()`를 호출하여 현재 Coroutine Context를 가져올 수 있습니다.

```kotlin
suspend fun a() {
    coroutineContext
    currentCoroutineContext()
}
```

Coroutine Context의 `get` 연산자 메소드를 실행하면 Key 인수에 해당하는 인스턴스를 가져올 수 있습니다.

```kotlin
import kotlin.coroutines.coroutineContext

suspend fun a() {
    coroutineContext[MyContext.Key]
}
```

### currentCoutineContext()?

`currentCoroutineContext()`는 `coroutineContext`의 결과를 반환하는 함수입니다. 이는 inline function이므로 컴파일 과정에서
인라이닝됩니다. 따라서 이 둘의 결과는 같습니다.

`coroutineContext`는 `CoroutineScope` 등의 속성입니다. 선언하는 scope에 따라 이름 충돌에 의한 의도치 않은 참조를 범하게 되는 경우를 방지하기
위한 일종의 별칭(alias)입니다.

자세한 사항은
[kotlinx.coroutines.CoroutineScope](https://github.com/Kotlin/kotlinx.coroutines/blob/d653ab9b021716959df9f5b694cb5e92c1834840/kotlinx-coroutines-core/common/src/CoroutineScope.kt#L316)
를 참고하시기 바랍니다.

# Hands-on

```kotlin
import kotlinx.coroutines.*
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.coroutineContext

object Application {
    @JvmStatic
    fun main(args: Array<String>) {
        runBlocking {
            withContext(MyContext("DongHoon")) {
                println(coroutineContext[MyContext.Key]?.userName)  // DongHoon
            }
        }
    }
}

data class MyContext(
    val userName: String,
) : CoroutineContext.Element {
    companion object Key : CoroutineContext.Key<MyContext>

    override val key = Key
}
```

# 기타 참고사항 정리

## Context를 결합해도 문제가 없을까?

가공 과정에서 원래의 Context 인스턴스가 훼손되지 않는 한 문제는 없습니다. 다음의 검증 코드를 참고하시기 바랍니다.

```kotlin
import kotlinx.coroutines.*
import kotlin.coroutines.coroutineContext

// ...

withContext(
    MyContext("DongHoon") +
        @OptIn(DelicateCoroutinesApi::class)
        newFixedThreadPoolContext(2, "A thread pool") +
        Dispatchers.Default +
        SupervisorJob()
) {
    println(coroutineContext[MyContext.Key]?.userName)    // DongHoon
}
```

## ThreadLocal을 사용하지 않은 이유

Kotlin Docs에는 친절히 ThreadLocal로 데이터를 전달할 수 있다고 설명되어 있습니다.
[참고](https://kotlinlang.org/docs/coroutine-context-and-dispatchers.html#thread-local-data)

이처럼 ThreadLocal을 사용하면 될 일을 Coroutine Context를 상속하여 구현하는 이유는, 대체로 SoC 디자인 원칙에서 콘텍스트(예: 세션) 단위로
격리 가능한 공통의 데이터를 취급할만한 방법이 없기 때문입니다.

## 간편하게 사용하는 방법

data class를 정의할 때마다 key 등의 `CoroutineContext`에 필요한 멤버를 정의하는 것은 번거로울 수 있습니다.
아래와 같이 `AttributeContainer`를 생성하여 활용하면 보다 간편하게 사용 가능합니다.

[Gist(donghoon-yoo/AttributeContainer.kt)](https://gist.github.com/donghoon-yoo/0bf09dcf91df482271dffc506fd70336)

```kotlin
// Example.kt
data class MyContext(
    val userName: String,
) : AttributeContainer

suspend fun main() {
    withContext(MyContext(userName = "DongHoon")) {
        println(container<MyContext>()?.userName)   // DongHoon
        a()
    }
}

suspend fun a() = run<MyContext> {
    println(userName)   // DongHoon
}


// Library.kt
import kotlinx . coroutines . currentCoroutineContext
    import kotlin . coroutines . CoroutineContext


interface AttributeContainer : CoroutineContext.Element {
    @InternalApi
    data class Key(val fqName: String) : CoroutineContext.Key<AttributeContainer>

    @InternalApi
    override val key: CoroutineContext.Key<*> get() = Key(fqName)

    val fqName: String get() = this::class.toString()
}


suspend inline fun <reified T : AttributeContainer> container(): T? =
    @OptIn(InternalApi::class)
    currentCoroutineContext()[AttributeContainer.Key(T::class.toString())] as? T

suspend inline fun <reified T : AttributeContainer> run(block: T.() -> Unit) {
    container<T>()?.block()
}


@RequiresOptIn
private annotation class InternalApi
```
