# 제안: sample-v0 smallMonster 색 예산 9 → 12 (승인 전 — 바이블 미변경)

시안 고블린(docs/quality-ref/target-grids.json)은 외곽선 포함 12색을 쓴다. 지금 예산 9에서는 color.budget-fit이 3쌍을 병합한다(`forge build data/specs/sample/goblin.spec.json`, out/goblin/qa.json `budget`):

| 예산 | 병합(전 프레임 픽셀) | 형태 영향 |
| --- | --- | --- |
| 9(현재) | goblin_skin 2→1(238), metal 2→3(47), leather 2→1(91) | 이마·귀 안쪽 밝은 면(L)이 사라져 정면 얼굴·귀 판독 약화, 단검 명암·허리끈 무늬 소실 |
| 10 | goblin_skin 2→1, metal 2→3 | 허리끈만 복원. 얼굴·귀 밝은 면은 여전히 소실 |
| 11 | goblin_skin 2→1 | 얼굴·귀 밝은 면 소실 |
| 12 | 없음 | 시안 그대로 |

시안 대비 rest 픽셀 차이(`forge compare … --sheet 8`의 refDiff, 시안은 예산 무제한 렌더): 예산 9 → 30px, 12 → 0px. 예산 계산에 피격 플래시 색(fx)도 들어가 rest 단독(11색)보다 1색 많이 센다 — 12면 플래시 포함 12색이라 병합 없음.

시험은 바이블 파일을 바꾸지 않고 임시 복사본에서 했다. 스켈레톤은 5색이라 영향 없음.

## 제안
- **12**(시안 그대로) — 지시의 상한 10으로는 핵심 형태(얼굴·귀 밝은 면)가 복원되지 않는다.
- 대안: 10으로 올리고 시안의 L(goblin_skin:2)을 H로 합치는 시안 수정(형태 변경이라 사용자 확인 필요).

## 승인 후 할 일
`data/bibles/sample-v0.bible.json` colorBudget.smallMonster 변경 → build-all sample → 골든 갱신(`golden:`) → 재검수.
