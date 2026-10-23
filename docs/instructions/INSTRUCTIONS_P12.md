# 지시문 P12 — 결정 반영·문서 정리·체험 F·에셋 등록부 (사용자 승인 2026-10-23 13:21)

작성: 클로드. 실행: 코덱스. 선행: P11(병렬 가능 — 같은 파일을 건드리지 않음). 대상: seonggeom `codex/g2-approved-handoff`, pixel-forge main.
근거: DECISIONS_DEMO_20261023.md(이 지시문과 함께 전달). 그림 생성 API 호출 금지. 범위 밖 판단은 `질문:` 줄.

## 0. 승인 범위
- 허용: 결정 기록 반영, 문서 신규·갱신, 직업 체험 세션의 F 해금 예외(D-TRIAL-F), 에셋 등록부 생성 스크립트.
- 금지: PR 병합·브랜치 삭제(정리안만 작성), 캠페인 3미션 전투 수치·히트박스·저장 형식 변경, 17JSON 변경, 정식 에셋 승격.

## 1. 결정 기록 반영
1. `DECISIONS_DEMO_20261023.md`를 seonggeom `docs/DEMO_DEV/DECISIONS_DEMO_20261023.md`로 추가(원문 그대로).
2. `docs/DEMO_DEV/COM_001_INPUTS/Seonggeom_MVP_Approval_Decisions_v1_2.md` → **v1_3 새 파일**: D06-DODGE·D06-ULT·D06-SKILLS를 APPROVED(데모 값), D07~D11 APPROVED, D12 DEFERRED, 추가 결정 ID 목록 링크. v1_2는 보존.
3. pixel-forge `docs/integrated/G2/DECISIONS.md`에 D-BOSS-DIR·D-GATE-DMG·D-CLASS-ART·D-ART-TRACK 4줄 + 링크.

## 2. 체험 F 예외 (D-TRIAL-F)
1. 직업 체험 세션(demo/class_trial/) 시작 시 공통 F를 **해금 + 게이지 최대**로 시작. 사용 후 충전은 기존 공식.
2. 구현 위치: 체험 세션 초기화 한 곳. 캠페인 미션(PRO-01·CH1-01·CH1-02)의 45초 해금 경로는 코드 공유하더라도 **동작 불변**이어야 한다.
3. 체험 안내 문구 1줄 추가(키: `trial.hint.ult_ready`, 값 "필살기 「맹세의 일섬」을 바로 쓸 수 있습니다 — F"). 문자열은 P13 외부화 방식 전이므로 기존 안내 문구 위치에 넣고 키 이름만 주석.
4. 테스트: (a) 체험 3직업 모두 t=0에 F 사용 가능, (b) PRO-01·CH1-01·CH1-02는 기존 해금 테스트 그대로 통과, (c) 봇 체험 1회씩 F 사용 1회 이상 기록(직업별 시간·남은 HP 표 갱신).

## 3. 데모 동결 목록 문서화 (D06-SKILLS)
`docs/DEMO_DEV/DEMO_SKILL_FREEZE.md`: 현재 데모에서 실제 등장 가능한 자동 스킬·패시브·랭크·성장 카드의 ID·이름·효과·수치·출처 파일(줄 번호)을 표로. 실제 코드 경로에서 도달 가능한 것만(데이터에만 있고 안 나오는 것은 별도 표 "데이터에만 존재"). 수치 변경 없음.

## 4. 통합 기획서 v1.1
1. `docs/integrated-game-plan-20261022` 브랜치의 `SEONGGEOM_INTEGRATED_GAME_PLAN.md`를 기준으로 **codex/g2-approved-handoff에 `docs/PROJECT_PLAN/SEONGGEOM_INTEGRATED_GAME_PLAN_v1_1.md` 새 파일**(md만, PDF·Word 생성 금지).
2. 바꿀 것만 바꾼다(나머지 문장 보존):
   - 3.2 세라: 망토 없음·갈색 눈(CANON-SERA-NO-CAPE / BROWN-EYES). GDD 2.3 "푸른 눈"과의 차이를 각주로.
   - 5.1 방어 대상: placeholder → 피난민 마차.
   - 4.2 회피·F: "실험 계약" → "데모 확정값(D06, 2026-10-23)". 체험 F 예외 추가.
   - 9절 아트: pixel-forge 라인(사용자 ChatGPT 일러스트 → intake/make → 후보), 1280×720·2배·짝수 스냅, 승인 셀 5종, 캐릭터 공통 팔레트 32/24, 이펙트는 pxl 코드 생성, SF 트랙은 연구 보관(D-ART-TRACK).
   - 10절 현황 표에 G1·G2·P10·P11 행.
   - 12절 우선순위를 DEMO_GAP_REVIEW 5절 마일스톤(M1~M6, M6·오디오 보류)으로 교체.
3. 머리말에 "v1.0 대비 변경 요약" 10줄 이하.

## 5. PR·브랜치 정리안 (작성만)
`docs/DEMO_DEV/BRANCH_CONSOLIDATION_PLAN.md`:
- 원격 브랜치 전부와 PR #1~19 표: 이름 / 마지막 커밋 날짜 / 목적 / main 대비 고유 커밋 수 / 판정(데모 기준에 올림 · 연구 보관 · 폐기 후보) / 근거 한 줄.
- 데모 기준 브랜치 제안: 어떤 순서로 무엇을 합칠지(충돌 예상 파일 목록 포함). 실행은 하지 않는다.
- `gh` 사용 가능하면 PR 메타데이터로, 불가하면 git만으로.

## 6. 에셋 등록부 (MVP 7.2 11열, 스팀 AI 공개 대비)
1. 스크립트 `scripts/codex/asset_register.py`(표준 라이브러리만): `art/candidates/**/manifest.json`과 provenance를 읽어 `docs/DEMO_DEV/ASSET_REGISTER.md` + `.csv` 생성.
   열: asset_id / 역할 / 경로 / 제작자·출처 / 사용권 근거 / AI 사용 / 원본·수정 내역 / 승인자·일시 / Godot 임포트 / GUI 검수 / 빌드 포함 여부.
2. 값이 없으면 빈칸이 아니라 `미확인`. rightsReviewed=false는 그대로 표시(자동 true 금지).
3. 글꼴(NotoSansKR)·pxl 이펙트(AI 사용 아님 — 코드 생성)·도형 그래픽 행도 포함.
4. 테스트: 후보 5종 + fx 12종 + 글꼴 행 존재, 재실행 시 결과 동일(결정론).

## 7. P11 보충 (전달받은 1줄 반영)
P11 4-1 사양 표에 `demo/data/demo_080_classes.json`의 GUARD 135/145°, SWIFT 110/90°(2연격 0.12초), RUNE 125/110° 포함 → 직업별 검기 변형 생성·체험 세션 매핑. P11 진행 중이면 P11 커밋에, 끝났으면 이 지시문에서.

## 8. 수락
- 1절 파일 3곳, v1_3 결정 목록.
- 2절 테스트 3종 통과 + 직업별 F 사용 기록 표.
- DEMO_SKILL_FREEZE.md, 기획서 v1.1(변경 요약 포함), BRANCH_CONSOLIDATION_PLAN.md, ASSET_REGISTER.md/.csv.
- 기존 회귀: G1·G2·demo_050_integration·DEMO-080 체험 테스트 실패 0.

## 9. 보고 (10줄, P11과 같은 형식)
```
[P12] seonggeom <커밋> / pixel-forge <커밋>
완료: … / 수락: <명령> → <결과 줄> / 경고·불일치: … / 요청: … / 질문: …
```
