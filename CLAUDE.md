# CLAUDE.md — pixel-forge

AI가 조작하는 **도트 에셋 생산 라인**. 사람이 아닌 클로드 코드가 CLI로 캐릭터 설계(JSON)를 렌더링·검수·패킹해 게임에 바로 쓰는 스프라이트를 만든다.
이 파일은 매 세션 로드된다. **짧게 유지하고, 세부는 docs/를 필요할 때만 읽는다.**

## 0. 세션 시작 절차 (항상 이 순서)
1. 세션 시작 훅이 주입한 현재 단계·로그를 확인(progress.md Read 생략)
2. 해당 `docs/phases/P{n}.md` **하나만** 읽기
3. 그 단계가 참조하라고 명시한 `docs/ARCHITECTURE.md`의 절(section)만 읽기 (전체 읽기 금지)
4. 작업 계획을 3~7줄로 `docs/progress.md`에 적고 시작
5. 끝나면 /phase-done 스킬로 마무리

## 1. 절대 규칙 (위반 시 작업 중단 후 보고)
- **결정론**: `Math.random`, `Date.now`, 시스템 시간 사용 금지. 난수는 `core/prng.ts`의 시드 PRNG를 인자로 주입. 같은 입력 → 같은 바이트 출력.
- **인덱스 색 우선**: core·render·qa는 `IndexedRaster`(팔레트 인덱스)로만 작업. RGBA 변환은 io/export에서만. 팔레트 밖 색은 구조적으로 생길 수 없어야 한다.
- **안티앨리어싱 금지**: 모든 확대·축소·회전은 최근접(nearest). 보간 필터, 블러, 알파 반투명 픽셀 금지(알파는 0 또는 255).
- **순수 코어**: `packages/core|rig|render|qa|export`에서 `fs`, `path`, `process` import 금지. 파일 입출력은 `packages/cli`의 io 어댑터에서만.
- **경계에서 한 번만 검증**: JSON 입력은 `packages/spec`의 zod 스키마로 CLI 진입 시 1회 검증. 내부 함수는 검증된 타입을 신뢰.
- **의존성 허용 목록 외 설치 금지**: `typescript, vitest, zod, pngjs, @types/node, @types/pngjs, chokidar(P5부터)`. 그 외는 progress에 사유를 적고 사용자 승인 대기.
- **범위 준수**: 현재 Phase의 범위 밖 기능·리팩터링 금지. 발견한 개선점은 `docs/backlog.md`에 한 줄로 기록만.
- **Godot 관련 작업 금지**: 사용자가 명시적으로 지시하기 전까지 Godot 익스포터·이식 작업을 하지 않는다.
- **저작권**: 상용 게임 스프라이트·튜토리얼 이미지를 저장소에 넣지 않는다. 레퍼런스는 측정값(JSON)과 출처 URL·라이선스만 저장.

## 2. 코딩 규칙
- Node 22, TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, ESM only. `any` 금지(불가피하면 `unknown` + 좁히기).
- 모듈 1파일 ≤ 250줄, 함수 ≤ 60줄. 넘으면 분리.
- 픽셀 루프는 TypedArray + 정수 인덱스(`y * w + x`). 픽셀당 객체 생성 금지.
- 공개 함수는 순수 함수 우선. 입력 래스터를 변경하는 함수는 이름에 `InPlace` 접미사.
- 에러는 `ForgeError(code, message, detail?)` 하나로. CLI 종료 코드: 0 성공, 1 검증 실패, 2 QA 불합격, 3 내부 오류.
- 이름: 파일 `kebab-case.ts`, 타입 `PascalCase`, 함수 `camelCase`, 상수 `UPPER_SNAKE`.
- 주석은 "왜"만. 근거 규칙이 연구 문서에서 온 경우 `// rule: <rule-id>` 태그.
- 테스트: 모듈마다 `*.test.ts`. 렌더 결과는 **골든 해시 테스트**(PNG 바이트 SHA-256)로 고정. 골든 갱신은 의도된 변경일 때만, 커밋 메시지에 `golden:` 표기.

## 3. 토큰 절약 규칙
- 파일 탐색은 Glob/Grep으로 대상만. 디렉터리 전체 Read 금지.
- 이미 읽은 파일은 다시 읽지 말고 수정 지점만 Edit.
- 편집 시 관련 테스트는 훅이 자동 실행. 전체 테스트는 test-runner 서브에이전트로만.
- CLI 출력은 기본 **한 줄 JSON 요약**. 상세는 파일로 쓰고 경로만 출력.
- 이미지 확인은 **컨택트 시트 1장**만 Read. 개별 프레임 PNG를 하나씩 열지 않는다. 반복 개선 루프 1회당 최대 1장.
- 같은 오류로 2회 수정 실패 → 멈추고 원인 가설 3줄 + 필요한 결정을 progress에 적고 사용자에게 보고.
- 긴 설명 출력 금지. 작업 보고는 "완료 항목 / 수락 기준 결과 / 다음 할 일" 3블록, 10줄 이내.
- 단계(Phase) 완료 시에만 「pixel-forge 작업 보고」 문서(https://claude.ai/artifact/ST1vmzv6Vx15CRwXBXbS38)를 갱신한다. 진행 현황 표의 상태 칸만 수정하고, 결과 섹션은 15줄 이내(표 최대 1개)로 진행 현황 바로 아래에 추가한 뒤 링크를 준다. 단계 중간에는 문서를 건드리지 않는다.

## 4. 명령
```
pnpm install
pnpm build          # tsc -b
pnpm test           # vitest run
pnpm forge <cmd>    # CLI (packages/cli)
```

## 5. 문서 지도 (필요할 때만 읽기)
- `docs/ARCHITECTURE.md` — 패키지 구조, 데이터 모델, DSL 스키마, 알고리즘 (절 번호로 참조)
- `docs/phases/P0~P10.md` — 단계별 작업서
- `docs/references.md` — 기준작(브로테이토·뱀파이어 서바이버즈) 측정 목표
- `data/rules/default.rules.json` — 도트 규칙 수치 (연구 근거 포함)
- `data/bibles/*.bible.json` — 프로젝트별 아트 바이블
- `docs/progress.md` — 진행 로그 (단계당 10줄 이내 유지)
- `docs/backlog.md` — 범위 밖 아이디어

## 6. 도구 활용
- **훅(자동)**: `.claude/settings.json`
  - 세션 시작 시 현재 단계·최근 로그가 자동 주입된다 → progress.md를 따로 Read하지 않는다.
  - `packages/*/src/*.ts` 편집 직후 규칙 검사(결정론·순수 코어·any·250줄) + 관련 테스트가 자동 실행된다. 통과 시 출력 없음. 차단 메시지를 받으면 그것부터 고친다. 편집 후 테스트를 수동으로 다시 돌리지 않는다.
- **서브에이전트(위임)**: 긴 출력·이미지·독립 판단은 메인 대화 밖에서 처리한다.
  - `test-runner`(haiku): 전체 빌드·테스트·수락 기준 실행. 메인에서 `pnpm test` 전체 실행 금지(훅이 관련 테스트를 이미 돌림).
  - `pixel-reviewer`: 렌더 결과 시각 검수. 메인에서 이미지 Read 금지, 이 에이전트에 위임.
  - `code-reviewer`(sonnet): Phase 종료 전 독립 검토.
- **스킬**
  - `/phase-done`: Phase 마무리 절차(수락 기준 → 검토 → 시각 검수 → 기록·커밋·보고). Phase 끝에는 반드시 이 스킬로.
  - `/tool-scan`: 외부 도구 조사 → `docs/tooling.md`. 외부 도구는 tooling.md에 "사용 가능"인 것만 쓴다.
- **작업 습관**
  - Phase 시작 시 플랜 모드로 계획을 세우고 승인 후 구현한다.
  - 작업 단위가 끝나면 `/compact`로 대화를 압축한다. Phase가 바뀌면 새 세션을 연다.
- **외부 도구 원칙**: Aseprite·ImageMagick·Lospec 등은 전부 선택 기능이다. 없으면 건너뛰고, 저장소 런타임 의존성에 추가하지 않는다. 렌더 파이프라인 안에 외부 도구를 넣지 않는다.
