# AGENTS.md — pixel-forge (Codex·모든 에이전트 공통)

AI가 CLI로 도트 스프라이트를 만들고 검수·포장해 게임에 넣는 에셋 생산 라인. 첫 적용 게임은 「성검의 맹세」(kosmosgg-ui/seonggeom).
**이 파일이 단일 기준이다.** CLAUDE.md와 .claude/는 Claude Code 전용 보조 장치이며 같은 규칙을 담고 있다(충돌 시 이 파일 우선).

## 0. 세션 시작 (훅 없음 → 직접)
1. `docs/HANDOFF_CODEX.md`(현재 상태·미결정·다음 작업)와 `docs/progress.md` 맨 위 "현재 단계"·최근 로그 3개만 읽는다.
2. 진행 중 지시는 `docs/integrated/G2/`(README → DECISIONS.md → 맡은 지시문 1개). DECISIONS.md가 지시문보다 우선.
3. 작업 전 계획 3~7줄을 progress.md에 적고 시작.

## 1. 절대 규칙 (위반 시 중단 후 보고)
- 결정론: Math.random·Date 금지(시드 PRNG `core/prng.ts` 주입). 순수 코어: core·rig·render·qa·export·import에 fs·path·process 금지(I/O는 cli·gen 패키지만). any 금지. 파일 ≤ 250줄(테스트 제외).
- 인덱스 색만(core·render·qa는 IndexedRaster). 확대·축소·회전은 최근접, 알파 0/255. 단 import의 축소는 알파 사전곱 BOX(지시문 확정 사항).
- JSON 입력은 zod 스키마로 CLI 진입 시 1회 검증.
- 의존성 허용 목록: typescript, vitest, zod, pngjs, @types/node, @types/pngjs, chokidar. 그 외는 사용자 승인. 외부 도구(pxl 커밋 2e72b9a, Aseprite, ffmpeg, Blender)는 저장소 밖 선택 도구.
- **사람 승인 지점**: 바이블 변경, rules 수치 변경, 새 view/kind, 출시용 산출물, 게임 저장소 정식 경로 승격 → 제안서(docs/proposals/)만 작성.
- 범위 밖 기능·리팩터링 금지 → docs/backlog.md 한 줄.
- 경로 인자는 cli `resolveInside`, 밖이면 ForgeError("io.path-escape"). 게임 저장소 출력은 `.forge/targets.local.json`의 `@seonggeom`(art/candidates/만).
- 생성 원본·결과 PNG 커밋 금지(data/import, out/ 는 gitignore). 상용 스프라이트 저장소 반입 금지.
- 이미지 생성 API 호출 금지(사용자 결정: GPT 이미지는 사용자가 ChatGPT에서 직접 만들어 전달 — P9-M 수동 흐름).

## 2. 코딩 규칙
Node 22, TS strict + noUncheckedIndexedAccess, ESM. 파일 kebab-case, 함수 ≤ 60줄, 픽셀 루프는 TypedArray, 입력 변경 함수는 `InPlace`, 에러는 `ForgeError(code,message,detail?)`, 종료 코드 0/1/2/3. 주석은 "왜"만, 규칙 근거 `// rule: <id>`. 외부 형식은 공식 문서 URL 주석. 모듈마다 `*.test.ts`, 렌더는 골든 해시, 갱신 커밋에 `golden:`.

## 3. 검사·검증 (Claude Code 훅·서브에이전트 대체)
- **편집할 때마다**: `node scripts/check-rules.mjs` — 바뀐 파일(git diff)에 위 절대 규칙 검사 + 관련 테스트만 실행. 통과 시 출력 없음.
- **커밋 전**: `pnpm build && pnpm test` 전체(결과 줄 `Tests N passed`를 보고에 첨부).
- **시각 판정**(Claude의 art-judge 대체): `pnpm forge lineup`으로 보정 세트 v2(docs/integrated/P7close/calibration-v2, 48px 대상은 A48과 비교)와 대상을 시트 1장으로 만든 뒤, 먼저 기준 4장의 순서(D<C<B<A)를 스스로 다시 매기고 맞을 때만 등급(`<D`…`>A`) + 관찰 3줄. 순서가 다르면 판정 무효로 보고(유도 재시도 금지). 이미지 확인은 판정 1회당 시트 1장.
- **단계 마무리**(Claude의 /phase-done 대체): 수락 기준 명령 실행 → `git diff --stat <단계 시작 커밋>..HEAD`로 변경 파일만 다시 읽어 규칙·성능 함정 자가 검토(높음 = 반드시 수정) → 시각 판정(렌더 결과가 있을 때) → progress.md 10줄 로그 → 커밋 `P{n}: …` → 보고.
- 같은 문제로 2회 실패하면 마지막 커밋으로 되돌리고 원인 가설 3줄을 progress에 적고 멈춰 보고.

## 4. 보고
"완료 항목 / 수락 기준 결과(명령·결과 줄) / 다음 할 일" 3블록, 10줄 이내. 사용자 결정이 필요한 항목은 docs/proposals/에 제안서 + 보고에 한 줄.

## 5. 명령·지도
```
pnpm install && pnpm build && pnpm test
pnpm forge <cmd>     # import --probe, intake, make, prompts, fx-import, lineup, compare, build, apply …
node scripts/check-rules.mjs
```
docs: ARCHITECTURE.md, phases/, progress.md, backlog.md, proposals/, integrated/(지시문·보정 세트), HANDOFF_CODEX.md
data: projects/seonggeom/(바이블·타깃·prompts·fx/sg_fx.px.js), rules/, bibles/
외부 도구: pxl — `git clone https://github.com/augusto-scarvalho/claude-pxl.git ~/tools/pxl && git -C ~/tools/pxl checkout 2e72b9a`, `PXL_BIN=~/tools/pxl/bin/pxl.js`
