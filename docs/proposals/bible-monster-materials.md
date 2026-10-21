# 제안: sample-v0 바이블에 몬스터 재질 2종 추가 (승인 대기)

P6 수락 기준의 적 캐릭터 중 2종이 바이블에 없는 재질을 필요로 한다. **바이블은 고치지 않았다**(사람 승인 지점). 아래 값은 바이블 파일을 바꾸지 않고 메모리에서 `buildBiblePalette`로 시험해 `palette.collision`(색 충돌·명도 순서) 검사를 통과한 조합이다.

| 재질 | base | steps | kind | 생성 램프(어둠→밝음) | 외곽선 톤 | 쓰는 캐릭터 |
| --- | --- | --- | --- | --- | --- | --- |
| `bone` | `#d6c9a0` | 3 | default | `#b3a589` `#d6c9a0` `#f5e6c9` | 자동 | skeleton(뼈 몸 전체), skeleton 뼈 곤봉 |
| `metal_rust` | `#a8582e` | 3 | metal | `#6d3320` `#a8582e` `#cb9069` | `#54312a` | goblin 녹슨 단검 |

바이블에 추가할 JSON(`materials` 안):

```json
"bone": { "base": "#d6c9a0", "steps": 3, "kind": "default" },
"metal_rust": { "base": "#a8582e", "steps": 3, "kind": "metal" }
```

## 이유
- **스켈레톤**: 몸 전체가 뼈라 실루엣의 대부분이 이 재질이다. 기존 `cloth_white`(`#d8d2c4`)는 회백색 천 톤이고, 같은 재질을 쓰는 성직자(cleric, role priest)와 군중 속에서 색으로 구분되지 않는다(§1 원칙 6). 노란 기가 있는 뼈 색이 필요하다.
- **고블린 녹슨 단검**: 기존 `metal`(청회색)은 "녹슨"이 읽히지 않는다. 주황 갈색 금속 램프가 필요하다. `kind: metal`로 명암 폭을 넓혀 7색 예산(smallMonster)에서도 날이 보이게 한다(form.held-thin-shade는 밝은 2단계 `#a8582e` `#cb9069`를 쓴다).
- smallMonster 예산 7색: 고블린 = goblin_skin + leather + metal_rust, 스켈레톤 = bone + leather(허리끈) 정도로 맞춘다. 초과분은 color.budget-fit이 병합한다.

## 승인하지 않을 때의 대체안
- 스켈레톤: `cloth_white`로 대체. 성직자와 색이 겹쳐 군중 판독이 약해진다.
- 고블린 단검: `leather`(날) + `metal`(날끝 장식)로 대체. "녹슨" 표현은 포기.

## 승인 후 할 일
1. 위 JSON을 `data/bibles/sample-v0.bible.json`에 추가(팔레트 견본 `forge palette sample-v0` 재생성, 골든 갱신 `golden:`).
2. `/forge`로 goblin·skeleton 생성 → build-all → review → apply.
