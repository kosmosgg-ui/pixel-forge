# HANDOFF_CODEX — Claude Code → Codex 인계 (2026-10-23)

## 1. 저장소 상태
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
1. 환경 확인: `pnpm install && pnpm build && pnpm test`(마지막 보고 기준 통과), pxl 설치(AGENTS.md 5절).
2. 사용자 결정 3절 답이 오면 해당 제안서 반영(바이블 `$history` 유지).
3. 세라 정면·뒷면 시트 수령 → intake/make → seonggeom candidates 갱신.
4. seonggeom: feature/g1-actor-sprites에서 Draft PR 상태 정리, Gate C 패키지(캡처·후보 시트) 사용자 확인 → 승인 후에만 정식 경로 승격·main 병합.

## 7. 도구 차이 (Claude Code → Codex)
| Claude Code | Codex에서 |
| --- | --- |
| CLAUDE.md, SessionStart 훅 | AGENTS.md + 이 문서를 직접 읽기 |
| PostToolUse 훅(post-edit.mjs) | `node scripts/check-rules.mjs` 수동 실행 |
| test-runner / code-reviewer / art-judge 서브에이전트 | AGENTS.md 3절 체크리스트 |
| /phase-done, report-doc 스킬 | AGENTS.md 3절 "단계 마무리" (Claude Docs 보고 문서 갱신은 생략, progress.md만) |
| .claude/ | 그대로 둔다(Claude Code 복귀 대비). 수정 금지 |
