---
icon: "🪟"
title: "Windows 부트로더 생성(복구)"
description: "수동으로 EFI 부팅 영역과 Windows 부트로더를 생성하는 방법"
pubDate: "2025-05-18T12:04:00+09:00"
---

## 프롤로그
~~앞으로 Windows를 더 사용할 일이 있을지는 모르겠으나~~ Windows 부트로더를 수동으로 생성하는 방법을 알아봅니다.

## EFI 부팅 파티션 생성
Windows에서는 `diskpart`로 파티션을 생성할 수 있습니다. 다음의 명령에 따라 EFI 파티션을 생성합니다. 단, 아래의 경우 `clean` 명령으로 초기화된 디스크를 위한 것입니다. 파티션 구성이 일반적이지 않은 경우, 그에 맞게 명령을 달리 사용해야 합니다. 지난 해 Windows 업데이트 시 EFI 파티션 크기가 부족해서 업데이트 실패 사례가 보고되었는데, 이러한 경우를 대비해서 500MB 내외로 조금 더 여유있게 구성하는 것도 좋습니다.
```powershell
diskpart
	select disk <Disk ID>
	convert gpt
	select partition 1
	delete partition override
	create partition EFI size=100
	format fs=FAT32 quick
```

## EFI 부팅 파티션 마운트
다음 명령을 실행하여 앞서 생성한 EFI 파티션의 UniqueID를 식별합니다.
```powershell
Get-Volume | Format-List
```

그런 다음, 다음 명령을 실행하여 파티션 식별자 문자를 부여하고 마운트합니다. 여기에서는 `Z`를 사용했습니다.
```powershell
mountvol Z: <UniqueID>
```

## Windows 부트로더 생성
Z 드라이브에 Windows 부트로더를 생성하고 C 드라이브를 부팅 항목으로 추가합니다. 부팅 대상이 여러 개인 경우 추가로 등록해도 됩니다.
```powershell
bcdboot C:\Windows /s Z: /f UEFI
```

---

## 레퍼런스
* [bcdboot](https://learn.microsoft.com/ko-kr/windows-hardware/manufacture/desktop/bcdboot-command-line-options-techref-di?view=windows-11)