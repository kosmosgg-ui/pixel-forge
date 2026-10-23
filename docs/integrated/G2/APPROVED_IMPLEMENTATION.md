# 승인 6건 구현 연결 — 2026-10-23

근거: [승인 원문](../../proposals/P10_G2_CODEX_APPROVALS.md). 사용자 후속 요청에 따라 실행 반영한다. 이전 인계의 설치 차단 기록은 과거 기록이며, 설치·빌드·289 passed/3 skipped로 복구된 뒤 진행했다.

| 승인 | 반영 경로와 동작 |
|---|---|
| fxPalette 13키 | seonggeom.bible.json → fx-import에서 검증 → out/pxl-source/effects.px.js의 pal() 주입 → pxl 빌드 및 같은 색 집합으로 QA. 원본 sg_fx.px.js에는 색을 중복 저장하지 않는다. 직접 pxl build 대신 forge fx-import를 사용한다. |
| hero32·적24 | 기존 colorBudget 유지, 직업 후보에도 paletteMax=32. 24색 실험안을 채택하지 않는다. |
| metal_blade | #c8d4dc, steps=3, kind=metal. 기존 qaContextOf가 읽어 form.weapon-separation을 활성화한다. 수치·판정 임계값 변경 없음. |
| cellGrow | sizeClasses.*.sheetSize에 승인 셀. composeCandidates에서 작은 부분도 승인 셀로 합성하고 발밑 여백·논리 키·배율을 보존. 승인 셀을 넘으면 make.cell-contract로 중단. 기본 size/height는 유지. |
| PRO-01 | prompts/props/refugee_cart.json에 고정 피난민 마차 요청. G1 안내/HUD에 정체 반영. 이동 호위·HP·공세·위치·히트박스·저장 변경 없음. CH1-02는 성문 유지. |
| GUARD/SWIFT/RUNE | prompts/actors/hero_sera_{guard,swift,rune}.json. GDD §8.3 실루엣과 공통 얼굴·체형·갈색 눈·참조 3종·32색. forge prompts로 수동 ChatGPT 후보 요청을 조립. 쌍검 필수 아님. 최종 디자인·출시 승인 아님. |

## 후보 셀 계약(1배)

| 등급/대상 | 기본 셀·앵커 | 승인 합성 셀·앵커 |
|---|---|---|
| hero / 세라·직업 후보 | 48×64 / 24,62 | 112×80 / 56,78 |
| enemy_small / 고블린 | 48×48 / 24,46 | 96×48 / 48,46 |
| beast / 늑대 | 64×48 / 32,46 | 112×48 / 56,46 |
| elite / 오크 | 64×64 / 32,62 | 128×64 / 64,62 |
| boss / 오크 대장 | 96×96 / 48,94 | 176×96 / 88,94 |

기존 G1 후보를 직접 편집하거나 원본 없이 재생성하지 않는다. 원본 시트/크기 참조를 받으면 intake/make로 재출력한다. 원본 PNG 골든 2건은 사용자 원본 2장이 있어야 실행 가능하며 대체 이미지를 넣어 통과시키지 않는다.

## 외부 도구 및 실행

pxl은 저장소 밖 /workspace/tools/pxl, 고정 전체 SHA 2e72b9ad5fae3709b1bcd81ea6a3cfc5eafbdb90. PXL_BIN=/workspace/tools/pxl/bin/pxl.js. forge fx-import는 불명/다른 커밋이면 빌드 전에 중단한다. pxl 통합 테스트도 PXL_BIN을 사용한다. Node 22.23.4(≥22.18), pnpm 10.28.0. `pnpm build && pnpm test`, `node scripts/check-rules.mjs`. G1 검증은 seonggeom 별도 격리 복사본과 XDG 경로에서 수행한다.

정식 에셋 교체·기존 PR 병합·게임 전투 수치 변경·이미지 생성 API 없음. ART_HOLD / 사용자 Gate C PENDING 유지.
