---
icon: "🤳"
title: "Compose Multiplatform, Android CameraX에서 전면 카메라 좌우반전 해제"
description: "SurfaceView로 인하여 Android CameraX의 전면 카메라 좌우반전이 해제되지 않는 문제 해결 방법"
pubDate: "2025-04-11T09:00:00.000Z"
---

## 프롤로그
Compose Multiplatform Android CameraX의 PreviewView에는 전면 카메라(셀피)의 좌우반전을 해제할 수 있는 옵션이 제공되지 않습니다. 
해결 방법 중 하나는 `scaleX` 값을 `-1f`로 두는 것인데, CameraX의 PreviewView는 기본적으로 SurfaceView 기반인 특성상 
`scaleX`의 효과가 적용되지 않는 문제가 있습니다.

## 해결 방법
이를 해결하려면 SurfaceView 대신 TextureView를 사용하면 됩니다. 이를 위해 PreviewView의 `implementationMode`를 변경합니다. 
그런 다음, 의도대로 `scaleX` 값을 변경하면 됩니다.

```kotlin
val previewView = remember { PreviewView(context) }

LaunchedEffect(previewView) {
    previewView.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    previewView.scaleX = -1f
}
```

## 기기 방향
기기 방향이 세로(Portrait)인 경우와 가로(Landscape)인 경우 각각 다르게 처리해야 합니다. 
필요에 따라 `scaleX` 또는 `scaleY` 값을 -1로 설정해 반전 방향을 조정해야 합니다.

## 에필로그
대부분의 셀피 촬영 환경에서는 프리뷰가 거울처럼 좌우가 반전되어 보여지는 것이 일반적입니다. 
만약 좌우반전을 임의로 해제하면, 사용자가 화면 속 자신의 움직임을 부자연스럽게 느낄 수 있으며, 
거울과 반대 방향으로 보이기 때문에 혼란을 줄 수 있습니다. 특히, 기기 방향이 portrait에서 
landscape로 바뀌면 상하 방향도 반전되어 보여지는 문제가 발생할 수 있으니 주의가 필요합니다. 
제 경우 셀피를 사용할 때 이를 의식하지 못했는데, 이번에 새로 알게 되어 함께 남겨둡니다.