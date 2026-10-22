# G2 갱신 U3 — 세라·적 동작 시트 5장 등록 (사용자 생성 2026-10-23 07:42)

docs/integrated/G2/에 넣는다. 각 시트는 **한 줄 = 한 동작**, 옆모습 오른쪽, 칸·글자 없음. 기획 세션이 줄·프레임 분리와 게임 크기 변환을 미리 확인함(planning_check_*.png): **줄 사이 크기 일관됨, 프레임 수 대부분 일치, 다시 받을 줄 없음.**

## 1. 시트별 줄 구성 (위에서 아래, 실측 프레임 수)
| 파일 | 줄 → 동작(프레임) | 기준 크기(원본 → 1배) |
| --- | --- | --- |
| hero_sera__actions_side | attack 5 · hit 3 · dodge 3 · ultimate 6 | 서 있는 키 약 200px → 48 |
| enemy_goblin__actions_side | walk 4 · attack 4 · hit 2 · death 4 | walk 키 약 190 → 34 |
| enemy_wolf__actions_side | run 4 · dash_telegraph 2 · dash 3 · hit 2 · death 4 | run 몸길이 약 315 → 52 |
| enemy_orc__actions_side | walk 4 · attack **5** · hit 2 · death 4 | walk 키 약 209 → 52 |
| enemy_orc_captain__actions_side | idle 4 · walk 4 · cleave 6 · dash 8 · siege **7** · hit 2 · death 6 | idle 키 약 154 → 78 |
- 요청과 다른 프레임 수: 오크 attack 5(준비 자세 1 추가 — 그대로 사용), 대장 siege 7(머리 위 들기 2 → 예고 4프레임으로 매핑: 예고 450·450·500·유지, 발동 150, 회복 600·600 — ENEMIES.md 4절의 siege 행을 7프레임으로 갱신).
- 줄 분리: 프레임 바닥선(y)으로 군집, 줄 수는 위 표로 고정(`layout.rows` 지정). 기획 세션 분리 결과와 프레임 수가 같아야 한다.
- 크기: 시트 하나에 **배율 하나**(위 기준 크기). 세라는 보드 idle·walk와 같은 1배 크기(48)가 되는지 비교 시트로 확인.

## 2. 반드시 고칠 것 (기획 세션 변환에서 발견)
1. **마젠타 번짐**: 고블린·오크·대장 외곽에 분홍 테두리가 남는다. 마젠타 배경용 despill 추가 — 가장자리 2px 안에서 R·B가 G보다 크게 높은 픽셀의 R·B를 G 기준으로 끌어내림(초록 배경 despill과 대칭). 처리 후 외곽선색으로 정리.
2. **분홍 잡티**: 오크 hit, 고블린 attack 일부 프레임에 분홍·자홍 점(타격 효과를 그린 흔적)이 몸 안에 있다. 배경색과 색상(hue 280~320°)이 같은 계열이고 원화 팔레트에 없는 픽셀 덩어리는 제거(주변 다수색으로 흡수). 테스트: 합성 입력.
3. **피 얼룩**: 고블린 단검에 붉은 기가 약간 남아 있다. 48px에서는 1~2px. 무기 재질 픽셀 중 붉은 계열은 금속 램프로 치환(옵션, 결과 비교 시트로 보고).

## 3. 등록과 출력
- P9-M intake(동작 원본) → 48px 기준 make → seonggeom candidates 갱신. 매니페스트 animations에 위 동작 전부, 대장은 ENEMIES.md 4절 시간(siege 7프레임 갱신).
- 세라 attack은 G1 결정대로 "서 있을 때만 재생", ultimate는 컷인과 함께.
- 비교 시트 1장: 캐릭터별 동작 한 줄씩 + 세라 기준 크기 줄. pxl study 수치(외톨이·밴딩) 기록.
- 보고 10줄.
