---
icon: "📦"
title: "Incus 프로젝트 독립 네트워크 오류 해결"
description: "OVN을 사용하지 않는 Incus 클러스터에서 프로젝트 독립 네트워크 생성 시 발생하는 오류 해결"
pubDate: "2025-09-06T18:10:00+09:00"
---

Incus에는 프로젝트 단위로 독립된 네트워크를 제공하는 기능이 있습니다. OVN[^OVN]을 사용하지 않는 클러스터에서 이 기능에 접근하면 프로젝트를 삭제할 수 없게 되는 문제가 있습니다.

## Incus 문서의 실수 유도
문서를 정독한 다음 이 기능을 포함하여 유창하게 인프라를 구성하면 높은 확률로 이 문제를 겪게 됩니다. Incus CLI 네트워크 생성 명령의 `--type` 인자의 기본 값은 `bridge`입니다. 독립 네트워크를 사용하는 프로젝트에서는 암묵적으로[^implicit-behavior] 기본 값이 `ovn`이 됩니다. 문서에는 관련 언급이 없습니다. 만약 기본 값 변경(breaking change) 등을 염두에 두고 `--type bridge`를 명시했다고 하더라도 독립 네트워크를 사용하는 프로젝트에서는 아래와 같은 안내를 보게 됩니다.

```shell
donghoon@donghoon:~# incus network create --project=test --type=bridge test
Error: Network type does not support non-default projects
```

여기에는 네트워크 유형을 지원하지 않는다는 의미만 있습니다. 문서를 정독해서 기본 값이 `bridge`라고 이해하는 사람은 단순히 `--type=bridge` 인자를 제거하면 `bridge`로 생성될 것이라고 오해할 수 있습니다. 실제로는 `ovn`으로 생성됩니다.

## 주의 사항
따라하지는 마세요.

## 문제 설명
독립 네트워크를 사용하는 프로젝트에 대하여 `--type=bridge` 인자 없이 명령을 실행한 결과는 다음과 같습니다.

```shell
donghoon@donghoon:~# incus network create --project=test test
Error: Failed loading network: Failed to connect to OVN: Failed to connect to OVS: Failed to connect to OVS: Failed to connect to OVS: failed to connect to unix:/run/openvswitch/db.sock: failed to open connection: dial unix /run/openvswitch/db.sock: connect: no such file or directory
```

결과 메시지, `incus list` 명령으로 보면 표면적으로는 생성에 실패된 것처럼 보입니다.

```shell
donghoon@donghoon:~# incus network list --project=test
+------+------+---------+------+------+-------------+---------+-------+
| NAME | TYPE | MANAGED | IPV4 | IPV6 | DESCRIPTION | USED BY | STATE |
+------+------+---------+------+------+-------------+---------+-------+
```

하지만 네트워크가 프로젝트를 삭제하려고 하면 무언가 잘못됨을 알 수 있습니다.

```shell
donghoon@donghoon:~# incus network delete --project=test test
Error: Failed loading network: Failed to connect to OVN: Failed to connect to OVS: Failed to connect to OVS: Failed to connect to OVS: failed to connect to unix:/run/openvswitch/db.sock: failed to open connection: dial unix /run/openvswitch/db.sock: connect: no such file or directory

donghoon@donghoon:~# incus project delete test
Error: Only empty projects can be removed.

donghoon@donghoon:~# incus project delete test --force
Remove test and everything it contains (instances, images, volumes, networks, ...) (yes/no): yes
Error: Failed loading network: Failed to connect to OVN: Failed to connect to OVS: Failed to connect to OVS: Failed to connect to OVS: failed to connect to unix:/run/openvswitch/db.sock: failed to open connection: dial unix /run/openvswitch/db.sock: connect: no such file or directory
```

Incus Cluster DB에서는 생성되었지만 보이지는 않는 일종의 좀비 네트워크가 됩니다. 아래처럼 프로젝트의 `used_by` 항목에는 네트워크가 존재하는 것으로 보입니다.

```shell
donghoon@donghoon:~# incus project show test
config:
  features.images: "true"
  features.networks: "true"
  features.networks.zones: "false"
  features.profiles: "true"
  features.storage.buckets: "true"
  features.storage.volumes: "true"
  restricted: "false"
description: ""
name: test
used_by:
- /1.0/networks/test?project=test
- /1.0/profiles/default?project=test
```

## 해결 방법
Incus Cluster DB에서 강제로 삭제해야 합니다. 프로덕션 인프라에서 하기에는 정말 위험한 방법입니다.

```shell
donghoon@donghoon:~# incus admin sql global "SELECT * FROM networks WHERE project_id = (SELECT id FROM projects WHERE name = 'test')"
+----+------------+---------------+-------------+-------+------+
| id | project_id |     name      | description | state | type |
+----+------------+---------------+-------------+-------+------+
| 4  | 5          | test          |             | 0     | 3    |
+----+------------+---------------+-------------+-------+------+

donghoon@donghoon:~# incus admin sql global "DELETE FROM networks WHERE project_id = (SELECT id FROM projects WHERE name = 'test')" 
Rows affected: 1
```

네트워크를 강제로 삭제한 다음 프로젝트를 삭제하면 정상적으로 처리됩니다.

```shell
donghoon@donghoon:~# incus project delete test
Project test deleted
```

---

[^OVN]: [Open Virtual Network](https://www.ovn.org)
[^implicit-behavior]: https://linuxcontainers.org/incus/docs/main/howto/network_create