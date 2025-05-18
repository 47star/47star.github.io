---
icon: "🐧"
title: "Linux 랩톱에서 덮개 닫기 동작 설정"
description: "Linux 노트북 덮개를 덮었을 때 동작을 변경하는 방법"
pubDate: "2025-05-18T11:44:00+09:00"
---

## 프롤로그
GNOME이나 KDE와 같은 GUI를 사용하지 않는 systemd 기반 Linux 랩톱에서 덮개 닫기 동작 등 구성 방법을 알아봅니다.

## 구성 방법
`/etc/systemd/logind.conf`에서 속성을 변경할 수 있습니다.

```
#  This file is part of systemd.
#
#  systemd is free software; you can redistribute it and/or modify it under the
#  terms of the GNU Lesser General Public License as published by the Free
#  Software Foundation; either version 2.1 of the License, or (at your option)
#  any later version.
#
# Entries in this file show the compile time defaults. Local configuration
# should be created by either modifying this file, or by creating "drop-ins" in
# the logind.conf.d/ subdirectory. The latter is generally recommended.
# Defaults can be restored by simply deleting this file and all drop-ins.
#
# Use 'systemd-analyze cat-config systemd/logind.conf' to display the full config.
#
# See logind.conf(5) for details.

[Login]
#NAutoVTs=6
#ReserveVT=6
#KillUserProcesses=no
#KillOnlyUsers=
#KillExcludeUsers=root
#InhibitDelayMaxSec=5
#UserStopDelaySec=10
#HandlePowerKey=poweroff
#HandlePowerKeyLongPress=ignore
#HandleRebootKey=reboot
#HandleRebootKeyLongPress=poweroff
#HandleSuspendKey=suspend
#HandleSuspendKeyLongPress=hibernate
#HandleHibernateKey=hibernate
#HandleHibernateKeyLongPress=ignore
#HandleLidSwitch=suspend
#HandleLidSwitchExternalPower=suspend
#HandleLidSwitchDocked=ignore
#PowerKeyIgnoreInhibited=no
#SuspendKeyIgnoreInhibited=no
#HibernateKeyIgnoreInhibited=no
#LidSwitchIgnoreInhibited=yes
#RebootKeyIgnoreInhibited=no
#HoldoffTimeoutSec=30s
#IdleAction=ignore
#IdleActionSec=30min
#RuntimeDirectorySize=10%
#RuntimeDirectoryInodesMax=
#RemoveIPC=no
#InhibitorsMax=8192
#SessionsMax=8192
#StopIdleSessionSec=infinity
```

덮개 닫기 동작입니다. 변경을 원한다면 주석을 해제하고 값을 변경하면 됩니다.
```
#HandleLidSwitch=suspend
#HandleLidSwitchExternalPower=suspend
#HandleLidSwitchDocked=ignore
```

systemd-logind에서 지원하는 주요 동작[^logind-action]은 다음과 같습니다. 커널 리로딩, 다시 시작(덮개를 덮었는데 다시 시작하는 것은 일반적이지 않으므로) 등은 제외했습니다.
* `ignore`: 아무 동작도 하지 않습니다.
* `poweroff`: 시스템을 종료합니다. (ACPI 전원 종료 명령)
* `halt`: 시스템을 종료합니다. (모든 프로세스 및 시스템 종료)
* `suspend`: 절전 모드로 전환합니다.
* `hibernate`: RAM을 디스크에 저장한 다음 시스템을 종료합니다. (Windows의 최대 절전 모드와 유사)
* `hybrid-sleep`: RAM을 디스크에 저장한 다음 절전 상태를 유지합니다.
* `suspend-then-hibernate`: `suspend` 전환 후, 일정 시간이 지나면 자동으로 `hibernate`로 전환합니다.
* `sleep`: 대기 모드로 전환합니다.
* `lock`: 로그온된 계정을 잠급니다.

이를테면, 덮개 닫기 동작을 완전히 무시하고자 한다면 다음과 같이 설정할 수 있습니다.
```
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

반영을 위해서는 다음의 명령을 실행합니다.
```
systemctl daemon-reload
systemctl restart systemd-logind
```

---

[^logind-action]: [systemd/systemd/src/login/logind-action.c](https://github.com/systemd/systemd/blob/741a184a31127305fb4363833ca9d97a1057fc68/src/login/logind-action.c#L424-L439)