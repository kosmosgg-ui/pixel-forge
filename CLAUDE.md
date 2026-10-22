# CLAUDE.md — pixel-forge

AI가 CLI로 캐릭터 설계(JSON)를 렌더링·검수·패킹해 게임에 바로 쓰는 스프라이트를 만드는 도트 에셋 생산 라인. 세부는 docs/를 필요할 때만 읽는다.

## 0. 세션 시작
1. 세션 시작 훅이 주입한 현재 단계·로그 확인(progress.md Read 생략)
2. `docs/phases/P{n}.md` 하나와, 그 단계가 지정한 ARCHITECTURE 절만 읽기
3. 계획 3~7줄을 progress.md에 적고 시작, 끝나면 /phase-done

## 1. 절대 규칙 (위반 시 중단 후 보고)
- 훅이 편집마다 강제: 결정론(Math.random·시간 금지, 시드 PRNG 주입), 순수 코어(core·rig·render·qa·export에 fs·path·process 금지), any 금지, 파일 ≤ 250줄.
- 인덱스 색만: core·render·qa는 IndexedRaster로 작업, RGBA 변환은 io/export에서만.
- 안티앨리어싱 금지: 확대·축소·회전은 최근접, 알파는 0 또는 255.
- JSON 입력은 spec의 zod 스키마로 CLI 진입 시 한 번만 검증.
- 의존성은 허용 목록만: typescript, vitest, zod, pngjs, @types/node, @types/pngjs, chokidar(P5부터). 그 외는 사용자 승인.
- IMPORTANT: 사람 승인 지점 — 바이블 변경, rules 수치 변경, 새 view/kind 추가, 출시용 산출물 생성은 사용자 승인 전 실행 금지. 제안서만 작성.
- 현재 Phase 범위 밖 기능·리팩터링 금지. 개선점은 docs/backlog.md에 한 줄만.
- 경로를 받는 명령(apply·ref·palette import 등)은 cli `resolveInside`로 정규화하고, 지정 폴더 밖이면 ForgeError("io.path-escape").
- Godot 작업 금지(지시 전). 상용 스프라이트·튜토리얼 이미지는 저장소에 넣지 않는다(측정값 JSON·출처·라이선스만).

## 2. 코딩 규칙
- Node 22, TS strict + noUncheckedIndexedAccess, ESM. 파일 kebab-case, 타입 PascalCase, 함수 camelCase, 상수 UPPER_SNAKE.
- 함수 ≤ 60줄. 픽셀 루프는 TypedArray + 정수 인덱스, 픽셀당 객체 생성 금지.
- 입력을 바꾸는 함수는 `InPlace` 접미사. 에러는 `ForgeError(code, message, detail?)` 하나. 종료 코드 0 성공, 1 검증, 2 QA 불합격, 3 내부.
- 주석은 "왜"만. 연구 근거 규칙은 `// rule: <id>`.
- 외부 형식(Aseprite JSON, PNG, 엔진 포맷 등)은 공식 문서를 확인한 뒤 구현하고, 해당 코드에 근거 URL 주석을 단다.
- 모듈마다 `*.test.ts`. 렌더 결과는 골든 해시(PNG SHA-256)로 고정, 갱신은 의도된 변경만 + 커밋에 `golden:`.

## 3. 작업·보고
- 탐색은 Glob/Grep으로 대상만. 이미 읽은 파일은 다시 읽지 말고 수정 지점만 Edit.
- 편집 시 관련 테스트는 훅이 자동 실행. 전체 테스트는 test-runner 서브에이전트로만.
- 이미지는 메인에서 Read하지 않는다 → art-judge. 개선 루프 1회당 시트 1장.
- CLI 출력은 한 줄 JSON 요약, 상세는 파일로 쓰고 경로만.
- 같은 문제로 2회 수정 실패 → 마지막 커밋으로 되돌리고, 원인 가설 3줄을 progress에 적은 뒤 사용자에게 /clear 후 재시작을 요청한다.
- 통과·완료 주장에는 실행한 명령과 결과 요약 줄(예: `Tests 145 passed`)을 반드시 첨부한다.
- 보고는 "완료 항목 / 수락 기준 결과 / 다음 할 일" 3블록, 10줄 이내. Phase 완료 시 보고 문서 갱신은 report-doc 스킬.

## 4. 명령
```
pnpm install && pnpm build && pnpm test
pnpm forge <cmd>    # CLI (packages/cli)
```

## 5. 지도
- docs: ARCHITECTURE.md(절 번호로 참조), phases/P0~P10.md, references.md(기준작 측정 목표), progress.md(단계당 10줄), backlog.md
- data: rules/default.rules.json(규칙 수치·근거), bibles/*.bible.json(프로젝트별 아트 바이블), models/<id>/(3D 모델 출처·재질 매핑, 모델 파일은 저장소 제외)
- 모드: 생물 기본 모드는 프로젝트 바이블의 defaultCreatureMode로 정한다 — import(외부 AI 도트, P8) · prerender(3D 모델) · atoms/frames(아이콘·얼굴 템플릿·이펙트·리그 없는 생물) · shapes(시안용)
- 서브에이전트: test-runner(전체 빌드·테스트), art-judge(시각 판정 — 보정 세트 v2, 축 "1배 게임 화면 SD 스프라이트 완성도"), code-reviewer(Phase 종료 전 독립 검토)
- 스킬: /phase-done(Phase 마무리), /tool-scan(외부 도구 조사), report-doc(보고 문서 형식), external-tools(외부 도구 원칙)
- 습관: Phase 시작은 플랜 모드, 작업 단위가 끝나면 /compact, Phase가 바뀌면 새 세션.

## 6. 압축 시 보존
압축 시 현재 Phase, 이번 Phase에서 수정한 파일 목록, 수락 기준 명령, 미해결 실패를 반드시 보존한다.
