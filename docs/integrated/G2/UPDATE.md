# G2 갱신 U1 — 망토 제거 + 보드 원본 등록 + 4개 동작 재요청 (사용자 결정 2026-10-23 06:55, 정사 변경 확정 07:16)

docs/integrated/G2/에 이 파일과 inputs/를 덮어 넣는다. 아래가 DECISIONS.md보다 우선(DECISIONS.md의 해당 두 줄도 이 내용으로 고쳐 커밋).

## 0. 정사 변경 (사용자 확정 2026-10-23 07:16)
세라 정체성 중 두 항목을 사용자가 의도적으로 바꿨다. 기획서와 충돌하지만 "사용자 최신 결정 > 문서" 규칙에 따라 이것이 정사다.
- **망토 없음**: 통합 기획서 §3.2의 "파란 망토" 보존 항목 삭제.
- **갈색 눈**: GDD §2.3·§8.2의 "푸른 눈"을 "갈색 눈"으로 변경.
- 유지: 갈색 포니테일, 파란 리본, 은색 갑옷, 파란색·금색 의상, 장검, 얼굴 정체성.
- 기획 문서 수정은 세션 B(seonggeom)가 CANON_CHANGE.md대로 처리한다. 세션 A는 바이블·프롬프트 템플릿만 맞춘다(`actors/hero_sera.json`: brown eyes, no cape).

## 1. 결정
- **망토 없음**이 정식 디자인. 기준 이미지 교체:
  - `hero_sera__ref.png` = 사용자 보드의 기준 원화(망토 없음, 3/4)
  - `hero_sera__turnaround.png` = 보드의 3방향 턴어라운드(망토 없음)
  - `hero_sera__size_ref.png` = 보드 대기 1프레임(크기 기준 — 이후 모든 동작 요청에 첨부)
  - 이전 ref·turnaround(망토 있음)는 `--kind reference`에서 해제하고 `superseded`로 표시(삭제 금지).
- 이전 walk_side(망토 없음, 단독 시트)와 보드 walk 중 **보드 walk를 채택**(기획 세션 실측: 머리 흔들림 2px로 가장 안정). 이전 것은 alt로 보존.

## 2. 보드 원본 등록 (P9-M intake)
기획 세션이 보드(`hero_sera__board_original.png`)를 동작별로 잘라 이름표·번호·테두리를 초록으로 지운 파일:
| 파일 | 동작 | 프레임 | 비고 |
| --- | --- | --- | --- |
| hero_sera__idle_side.png | idle side | 4 | 크기 기준과 같은 배율 |
| hero_sera__walk_side.png | walk side | 6 | 채택 |
| hero_sera__death_side.png | death side | 6 | **보드에서 약 0.67배로 작게 그려짐** → 크기 보정 필요 |
- 크기 보정 규칙(import 옵션 `scaleAnchor`): 동작의 "서 있는 프레임"(death는 1프레임)의 키를 `hero_sera__size_ref.png`의 키에 맞추는 배율을 그 동작 전체에 적용. 보정 배율을 매니페스트 `qa.scaleAnchor`에 기록. 보정 후 머리 크기(머리카락+얼굴 덩어리 폭)가 idle과 ±10% 안인지 검사(`anim.scale-consistency` 경고).
- 공격·피격·회피·필살기는 보드 것을 **쓰지 않는다**(크기 0.6~0.7배로 작고 궤적 이펙트가 그려져 있음) → 사용자가 동작별로 다시 받는다(아래 3).
- 보드에 그려진 하늘색 궤적은 어떤 동작에서도 쓰지 않는다(이펙트는 pxl).

## 3. 프롬프트 템플릿 갱신
- `actors/hero_sera.json` 캐릭터 설명에서 망토(cape) 삭제. 참조 이미지 목록 = ref, turnaround, size_ref.
- `base.json`에 크기 문장 추가: "The character must be exactly the same size as in the attached size reference (the standing idle frame): same head size and same height when standing upright."
- `base.json`에 "No slash trails, no motion effects, no glow — the character only." 강조.
- CHECKLIST: idle·walk·death = 등록, attack·hit·dodge·ultimate = 재요청(망토 없음, size_ref 첨부), front·back 동작은 그다음.

## 수락
- 6개 파일 intake, idle·walk·death 48px make → seonggeom candidates 갱신(death는 scaleAnchor 보정 결과 포함).
- 비교 시트 1장: idle·walk·death 한 줄씩, 머리 크기 일치 확인.
- 보고 10줄.
