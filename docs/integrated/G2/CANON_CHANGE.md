# 정사 변경 반영 — 세션 B(seonggeom)용 (사용자 확정 2026-10-23 07:16)

브랜치: feature/g1-actor-sprites(또는 별도 docs 브랜치). 문서 원문을 지우지 말고 **변경 기록을 덧붙이는** 방식으로 처리한다(이력 보존).

1. `data/15_decision_register.json`에 2건 추가:
   - CANON-SERA-NO-CAPE: 세라 기본 디자인에서 망토 삭제. 근거: 사용자 결정 2026-10-23 07:16. superseded: 통합 기획서 v1.0 §3.2 "파란 망토".
   - CANON-SERA-BROWN-EYES: 세라 눈 색 갈색. superseded: GDD Handoff 1.0 §2.3·§8.2 "푸른 눈".
2. 통합 기획서(SEONGGEOM_INTEGRATED_GAME_PLAN) §3.2 해당 문장 바로 아래, GDD(MASTER_GDD_ART_BIBLE_KO) §2.3 표와 §8.2 바로 아래에 각각 한 줄:
   `> 2026-10-23 사용자 결정으로 변경: 망토 없음, 갈색 눈(결정 등록부 CANON-SERA-NO-CAPE, CANON-SERA-BROWN-EYES).`
3. 전직 외형(GDD §8.3·§8.4)은 이 변경과 별개다. 전직별 망토·띠(예: 폭풍검객의 유동적인 망토)는 직업 장비로 허용된다 — 기본형에만 망토가 없다.
4. 원화 후보 중 금발·은발·푸른 눈 변형은 기존대로 미승인 기록 유지.
5. 커밋 메시지에 두 결정 ID. Draft PR 본문에 "정사 문서 변경 포함" 명시.
