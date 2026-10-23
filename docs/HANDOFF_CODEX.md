# HANDOFF_CODEX — Claude Code → Codex 인계 (2026-10-23)

## 0. 현재 인계 진입점(최신 작업 우선)

두 저장소의 후속 작업은 `codex/g2-approved-handoff` 브랜치에 커밋·푸시돼 있다. 아래 1절 표는 Claude 인계 당시 기준점이며 현재 HEAD로 간주하지 않는다.

읽는 순서: **AGENTS.md → docs/progress.md 최신 로그 → 이 문서 → 작업에 해당하는 아래 문서**. 기존 규칙을 새로 승인하거나 변경한 것이 아니라 현재 위치를 연결한 것이다.

- 개발 절대 규칙/코딩/검증: [AGENTS.md](../AGENTS.md), [규칙 검사](../scripts/check-rules.mjs). Node22·TS strict·결정론·순수 코어·의존성 허용목록·경로 제한·골든 갱신 규칙 유지.
- 확정 결정: [G2 DECISIONS](integrated/G2/DECISIONS.md), [승인6건](proposals/P10_G2_CODEX_APPROVALS.md), [실행 계약](integrated/G2/APPROVED_IMPLEMENTATION.md). 세라32/적24, fxPalette13키·metal_blade·승인 후보 셀5종, 마차/직업 후보 계약.
- 최신 이미지 요청: [NEXT_IMAGE_REQUESTS](integrated/G2/NEXT_IMAGE_REQUESTS.md). 정면 idle4/뒷면 idle4/정면 walk6부터. 기존 옆 방향5종은 변환 완료이며 재요청하지 않는다. state 미복원으로 CLI remaining=18은 실제 잔여 목록이 아니다.
- 게임 개발 기준: seonggeom/AGENTS.md → outputs/game-production/15_AI게임개발_운영원칙.md·16_현재상태와_개발일지.md → docs/GAME_DEVELOPMENT_STANDARD_v1.0.md. 현재 결과는 docs/DEMO_DEV/G2_CANDIDATE_REVIEW.md 및 DEVELOPMENT_HANDOFF.md.
- 검증 기록: pnpm build/test =294 passed/2 skipped(원본 PNG2장 부재). G1 ActorView13/0·실제 Xorg/Mesa 자동 캡처30장·고정 포즈9개. 자연 플레이·최종 미술 승인과 구분한다. 사용 Godot4.6.3, 인계4.7.2 호환성 미확인.
- 도구: Node22.23.4·pnpm10.28.0, pxl은 저장소 밖 /workspace/tools/pxl @2e72b9ad5fae3709b1bcd81ea6a3cfc5eafbdb90(PXL_BIN). 활성화/캐시/격리 경로는 환경 start_skill과 실행 계약 참고.
- 보호 범위: 이미지 생성 API 호출 없음, 후보/생성 원본 PNG 커밋 금지, .claude/ 불변, 정식 에셋 교체·기존 PR 병합·전투/히트박스/저장/17JSON 변경 없음. ART_HOLD/Gate C PENDING. 별도 승인이 필요한 작업을 문서 인계만으로 승인된 것으로 간주하지 않는다.

## 1. 인계 당시 저장소 상태(과거 기준점)
| 저장소 | 브랜치 | 커밋 | 상태 |
| --- | --- | --- | --- |
| kosmosgg-ui/pixel-forge | main | 35c4b79 (G2 U3) | P8 마감, P9-M·P10 0~3·G2 U1~U3 구현 완료. progress "P8-9 대기" |
| kosmosgg-ui/seonggeom | feature/g1-actor-sprites | 4c6afe6 | G1-5 완료(ActorView, evidence/g1, CH1-02 피크 성능 −4.0%), 후보 U3 갱신. main 병합 전(Draft PR·Gate C 대기) |

## 2. 확정 결정 (DECISIONS.md가 원본 — 여기는 요약)
- 그림 흐름: 사용자가 ChatGPT에서 일러스트 생성(초록 #00FF00, 초록 피부는 마젠타 #FF00FF, **한 줄 = 한 동작 시트**, 참조 이미지 첨부) → `forge intake` → `forge make` → seonggeom `art/candidates/`. **API·Codex 이미지 생성 호출 없음.**
- 화면: 뷰포트 1280×720 canvas_items, 스프라이트만 2배·짝수 스냅.
- 크기(1배): 세라 48px(셀 48×64, 발 24,62), 고블린 34, 늑대 몸길이 52(64×48), 오크 정예 52(64×64, 발 32,62), 오크 대장 77~80(96×96, 발 48,94). 주인공 32색, 적 24색.
- 정사 변경(사용자 확정): 세라 **망토 없음·갈색 눈**(GDD 파란 눈·통합기획 파란 망토 대체). 직업 장비 망토는 허용.
- 방향: 주인공·보스 down/up/side+미러, 적 side+미러.
- 이펙트: 코드로 그림(pxl, 커밋 2e72b9a, 저장소 밖) → `forge fx-import`. AI 생성 금지.
- G1: 이동 중 공격 = 걷기 스프라이트 + 검기 이펙트만, 필살기 컷인(0.35초 정지 중), 히트박스 불변, 효과음 보류.
- CH1-02 오크 대장 패턴: demo/data/ch1_02_slice.json 기준(CLEAVE 0.9/0.12/0.8, DASH 1.2/0.5/1.0, SIEGE 1.4/0.15/1.2). **구 프로토타입 적·보스(E1~E4, 철갑 추격관, 공명의 집행자) 혼입 금지.**

## 3. 인계 당시 사용자 결정 대기(후속 승인·구현 완료)

아래 6건은 이후 사용자 승인 및 구현 검증 완료. 최신 상태는 [승인 기록](proposals/P10_G2_CODEX_APPROVALS.md)과 [실행 연결](integrated/G2/APPROVED_IMPLEMENTATION.md)을 따른다. 정식 에셋 교체·기존 PR 병합은 여전히 범위 밖이다.
1. fxPalette 키(k/w/v/c/C/n/y/j/J/g/G/m/M) — docs/proposals/P10_fx_palette_colorbudget.md
2. colorBudget 32 → 24(24+정리: 잡티 17% 최소, 띠 56 최악)
3. metal_blade #c8d4dc
4. cellGrow(셀보다 큰 동작 프레임 셀 넓힘) — 현재 후보 전용
5. PRO-01 방어 대상(마차 권장)
6. 직업 GUARD/SWIFT/RUNE 의상 실루엣(GDD §8.3)

## 4. 남은 그림 (사용자가 ChatGPT로 생성 → 전달)
세라 정면·뒷면 idle·walk, 필살기 컷인 일러스트, 마차, 맵 타일, 직업 외형. 요청 목록은 `pnpm forge prompts <actorId>` → out/prompts/<actorId>/CHECKLIST.md(3개씩만 제시).

## 5. 이미지 받는 법 (Codex)
- Codex 채팅에 첨부 → 작업 폴더에 저장해 intake. 안 되면 사용자가 GitHub 웹에서 `art-inbox` 브랜치 `inbox/`에 업로드 → `git fetch origin art-inbox` 후 intake. **art-inbox는 절대 main 병합 금지.**
- 받은 이미지 판정은 `forge lineup` 시트 1장 + AGENTS.md 3절 절차.

## 6. 다음 작업 순서 (권장)
1. 새 작업에서는 기존 체크아웃·최신 progress를 확인한다. 도구/의존성이 유지돼 있으면 같은 설치·전체 테스트를 불필요하게 반복하지 않는다. 변경 영향에 맞춰 필수 검증을 수행한다.
2. 승인6건은 구현 완료이며 다시 결정을 요청하지 않는다. 바이블 `$history`와 미승인 범위를 유지한다.
3. NEXT_IMAGE_REQUESTS의3건 원본 PNG 수령 → intake/make → 후보 검수. 미복원 원본/참조를 지어내거나 JPEG로 바꿔 원본 검증을 통과시키지 않는다.
4. 기존 옆 후보의 크기·접지·잘림 경고는 G2_CANDIDATE_REVIEW 기록을 따른다. 후보 미술 등급은 AGENTS 절차로 판정하고 정식 경로 승격·기존 PR 병합은 별도 승인 전 보류한다.

## 7. 도구 차이 (Claude Code → Codex)
| Claude Code | Codex에서 |
| --- | --- |
| CLAUDE.md, SessionStart 훅 | AGENTS.md + 이 문서를 직접 읽기 |
| PostToolUse 훅(post-edit.mjs) | `node scripts/check-rules.mjs` 수동 실행 |
| test-runner / code-reviewer / art-judge 서브에이전트 | AGENTS.md 3절 체크리스트 |
| /phase-done, report-doc 스킬 | AGENTS.md 3절 "단계 마무리" (Claude Docs 보고 문서 갱신은 생략, progress.md만) |
| .claude/ | 그대로 둔다(Claude Code 복귀 대비). 수정 금지 |

## 2026-10-23 공정 보완 후속

최신 build/test=301 passed/2 skipped. 안전 baseline 병합/누락보호·상태/출력 예외복구·전체공통팔레트·컷인전용요청 적용. [잔여 제작 계약](proposals/G2_REMAINING_IMAGE_CONTRACTS.md), 게임 결과 seonggeom/docs/DEMO_DEV/G2_PROCESS_IMPLEMENTATION.md. 로컬 baseline5쌍은 data/import/<actor>/baseline, 색변환5종/report/lineup은 out/process-fix, 기존게임후보 불변. 세라31색/적18·11·12·14색. 신규 원본/state/spec는 여전히 미복원. 다음3요청은 기존 NEXT_IMAGE_REQUESTS.md, 새원본 수령후 별도출력 병합·사람검수. 검기90과현재데모110/100 불일치로 기본도형 유지, 게임수치를맞추지않는다.

## P11 재개 진입점

지시문 docs/instructions/INSTRUCTIONS_P11.md 0절만 허용. main ff 병합 완료(ad51afb), archive/restore CLI와 사용법 docs/instructions/P11_ARCHIVE_USAGE.md. 원본PNG 미수신·JPEG는derived:true만. 로컬out/art-source-worktree의 orphan art-source는main미병합/원격미푸시. 새 검기6쌍은fx/attack-specs.json·fx_slashes.json·sg_fx.px.js, 기존12종 보존. 패키지review/P11_review.zip은Git제외.
