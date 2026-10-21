# ARCHITECTURE — pixel-forge

> 각 Phase 문서가 "§번호"로 필요한 절만 지정한다. 지정되지 않은 절은 읽지 않는다.

## §1 목표와 설계 원칙
- **범용 툴**: 특정 게임에 묶이지 않는다. 게임마다 다른 것(해상도, 캔버스, 재질, 색 예산, 역할별 대표색, 산출물 위치)은 전부 Bible·Spec·어댑터 설정으로 받고, `packages/` 코드에는 게임 이름·경로·수치를 하드코딩하지 않는다.
- 입력: 캐릭터 설계 JSON(Spec) + 아트 바이블(Bible) + 규칙(Rules) + 리그(Rig) + 파츠 라이브러리
- 출력: 스프라이트 시트 PNG + 메타 JSON + QA 리포트 + 컨택트 시트 PNG
- 원칙
  1. **AI는 설계, 엔진은 도트**: 클로드는 픽셀을 직접 찍지 않고 형태·재질·포즈를 JSON으로 기술한다. 픽셀 규칙(램프, 외곽선, 정리)은 렌더러가 강제한다.
  2. **고해상도 축소 금지**: 모든 도형은 최종 해상도에서 직접 래스터화한다. (근거: HD-2D 업체 선정 사례)
  3. **뼈대 재사용**: 애니메이션은 리그 포즈로 정의하고 캐릭터 간 공유한다. (근거: Dead Cells)
  4. **색 예산 강제**: 스프라이트당 사용 색 수를 규칙으로 제한한다. (근거: Shovel Knight, Mina the Hollower)
  5. **검수가 품질을 만든다**: 모든 빌드는 자동 QA를 통과해야 산출물로 승격된다.

## §2 저장소 구조
```
pixel-forge/
  CLAUDE.md
  package.json            # pnpm workspaces, scripts: build/test/forge
  tsconfig.base.json
  packages/
    core/     # 래스터·팔레트·색·도형·정리 (순수)
    spec/     # zod 스키마 + 타입 (Spec, Bible, Rules, Rig, PartLib)
    render/   # Spec → 프레임 (셰이딩, 외곽선, 합성) (순수)
    rig/      # 뼈대, 포즈, 키프레임, 보간 정책 (순수)
    qa/       # 검사 + 점수 + 컨택트 시트 래스터 생성 (순수)
    export/   # 패커 + 포맷 직렬화 (순수, 바이트 반환)
    cli/      # forge 명령, io 어댑터(fs, png), 캐시
  data/
    rules/default.rules.json
    bibles/<project>.bible.json
    rigs/humanoid-side-v1.rig.json
    parts/<library>.parts.json
    specs/<project>/<id>.spec.json
    refs/<id>.ref.json        # 레퍼런스 측정값 (P6)
  out/                        # 빌드 산출물 (git 제외)
  .forge-cache/               # 해시 캐시 (git 제외)
  docs/ (ARCHITECTURE, phases/, progress.md, backlog.md)
  skills/forge/SKILL.md       # P6
```
의존 방향(단방향만 허용): `spec ← core ← rig ← render ← qa ← export ← cli`. `qa`는 `render`를 import하지 않고 프레임 배열만 받는다.

## §3 핵심 데이터 모델 (packages/core)
```ts
// 팔레트: 인덱스 0은 항상 투명
export interface Palette { colors: Uint32Array /* 0xRRGGBBAA */; names: string[] }

// 인덱스 래스터: 모든 처리의 기본 단위
export interface IndexedRaster { w: number; h: number; px: Uint8Array /* palette index, 0 = transparent */ }

// 램프: 한 재질의 명암 단계. index[0]=가장 어두움
export interface Ramp { id: string; indices: number[] /* palette indices, dark→light */ }

// 보조 버퍼 (렌더 중간 단계)
export interface ZoneBuffer { w: number; h: number; material: Uint8Array; shade: Uint8Array; depth: Uint8Array; part: Uint16Array }
```
- `material`: 재질 id(0=비어 있음), `shade`: 램프 단계, `depth`: 그리기 깊이(앞/뒤 판정), `part`: 파츠 id(외곽선·깜빡임 검사용)
- 최종 색 = `ramp[material].indices[shade]` → IndexedRaster로 확정(resolve)

## §4 색과 램프 (packages/core/color)
- 색 연산은 **OKLab/OKLCh**에서 수행, 결과를 sRGB로 변환 후 팔레트에 등록.
- 색상 회전: 항상 **최단 각도 방향**으로 목표 hue를 향해 단계당 `hueShift`°씩 이동하고, 목표 hue를 넘어가지 않는다.
- 색역 맞춤: OKLCh→sRGB 결과가 범위 밖이면 L과 h는 고정하고 C만 이분 탐색으로 줄여 범위 안에 넣는다(최대 20회).
- 최종 hex: 채널별 반올림 후 0~255 클램프. 서로 다른 재질에서 같은 hex가 나오면 팔레트 인덱스를 공유한다.
- 램프 생성 `makeRamp(base, rules.ramp)`:
  - 단계 수 `steps`(기본 5), 기준색은 가운데 단계
  - 밝아질수록 명도 +ΔL, 색상(hue)을 `warmHue`(기본 70°, 노랑) 방향으로 `hueShift`°씩 이동
  - 어두워질수록 명도 −ΔL, 색상을 `coolHue`(기본 260°, 파랑) 방향으로 이동, 채도는 가운데 단계에서 최대 → 양끝으로 `chromaFalloff`만큼 감소
  - 근거: Slynyrd Pixelblog 1(HSB 팔레트), rule `color.ramp.hue-shift`
- 전역 팔레트 = 바이블의 모든 재질 램프 + 외곽선색 + 이펙트색. **바이블에 없는 색은 렌더러가 만들 수 없다.**
- 색 예산 검사: 프레임 묶음 전체에서 사용된 고유 인덱스 수 ≤ `bible.colorBudget[sizeClass]`.

## §5 도형 래스터화 (packages/core/shapes)
모두 정수 좌표, 최종 해상도에서 직접. 결과는 `Mask`(Uint8Array 0/1) + 법선 근사.
- **채움 도형은 바운딩 박스 기준**(짝수 크기 지원): 크기는 반지름이 아니라 박스 폭·높이(px)로 받는다.
  - 중심 `cx = (w-1)/2`, `cy = (h-1)/2` (반픽셀 허용). 픽셀 (x, y)는 픽셀 중심 판정 `((x+0.5-cx')/(w/2))² + ((y+0.5-cy')/(h/2))² ≤ 1`로 채운다. 여기서 `cx' = cx+0.5`, `cy' = cy+0.5`(= w/2, h/2)로, 박스 안 픽셀 중심과 같은 좌표계다.
  - 그래서 w=6 원은 정확히 6px 폭이고 좌우 대칭이다.
| 도형 | 알고리즘 | 법선 근사 |
| --- | --- | --- |
| `line`(획) | Bresenham + pixel-perfect 정리(L자 모서리 제거) | 없음(획은 단일 shade) |
| `rect` `{ w, h, chamfer? }` | 정수 사각형, 선택적 모서리 깎기(`chamfer`) | 평면 + 가장자리 1px 베벨 |
| `ellipse` `{ w, h }` | 바운딩 박스 픽셀 중심 판정(위 식) | 구(sphere) 법선 |
| `capsule` `{ len, w }` | 축 길이 `len`, 두께 `w`(짝수 허용). 두 원 + 사각형의 합집합(축 방향 회전 지원) | 원기둥 법선 |
| `poly` | 스캔라인 채움(짝홀 규칙), 꼭짓점 ≤ 12 | 평면 + 지정 법선(`normalHint`) |
| `mask` | ASCII 그리드 직접 지정(§7.3) | 그리드의 shade 숫자 또는 평면 |
- 회전: 도형 파라미터를 회전시켜 **다시 래스터화**(해석적 회전). `mask` 파츠만 RotSprite 근사(8배 최근접 확대 → 회전 → 최빈값 축소)를 쓴다.
- 법선은 `Int8` 3채널 버퍼(nx, ny, nz ×127)로 보관. P7 노멀맵 출력에 재사용.

## §6 렌더 파이프라인 (packages/render)
프레임 1장 렌더 순서. 각 단계는 독립 함수, 단위 테스트 필수.
1. **포즈 해석**: Rig + Pose → 뼈별 월드 변환(정수 스냅된 위치, 각도)
2. **파츠 배치**: Spec의 파츠를 뼈에 부착, z순서 정렬(`rig.drawOrder` + 파츠 `z` 보정)
3. **래스터화**: 파츠별 도형 → ZoneBuffer에 depth 비교로 기록 (뒤쪽 팔·다리는 `depth`가 작다)
4. **셰이딩**: 픽셀별 `lambert = max(0, n·L)` + `ambient` → `rules.shade.thresholds`로 단계 양자화 → shade 기록
   - 뒤쪽 사지 보정: `shade -= rules.shade.backLimbDarken`(기본 1) — 깊이감 (rule `form.depth-cue`)
5. **클러스터 정리**: 같은 재질 안에서 크기 < `rules.cleanup.minCluster`(기본 2px)인 shade 섬을 주변 최빈 shade로 병합 → 노이즈·필로우 셰이딩 방지
6. **해석(resolve)**: material+shade → 팔레트 인덱스 → IndexedRaster
7. **외곽선**: `rules.outline.mode`
   - `selout`(기본): 실루엣 바깥 1px. 색 = 인접 재질 램프의 0단계, 광원을 향한 면(법선·L > `seloutLitThreshold`)은 1단계
   - `dark`: 전역 외곽선색 단일
   - 내부선: 서로 다른 파츠가 겹치고 depth 차이가 있으면 뒤 파츠 쪽 경계 1px를 해당 램프 0단계로
8. **정리**: 고립 픽셀 제거(8-이웃 중 같은 색 0개이고 외곽선 아님), 1px 획의 L자 모서리 제거
9. **검증 훅**: 팔레트 밖 인덱스, 반투명 알파가 없음을 assert (개발 모드)

## §7 DSL — 입력 JSON 스키마 (packages/spec)
### §7.1 Bible (`data/bibles/*.bible.json`)
```jsonc
{
  "id": "sample-v0",
  "internalResolution": [320, 180],      // 선택: 대상 게임의 내부 해상도(QA 가독성 검사용)
  "canvas": { "character": [48, 48], "smallMonster": [32, 32], "boss": [96, 96] },
  "pivot": "bottom-center",              // 발밑 중앙
  "light": { "dir": [-0.6, -0.7, 0.4], "ambient": 0.15 },
  "outline": { "mode": "selout", "globalColor": "#1a1020" },
  "colorBudget": { "character": 12, "smallMonster": 6, "boss": 20 },
  "materials": {                          // 재질 → 램프 기준색
    "skin": { "base": "#d9a07a", "steps": 4 },
    "cloth_red": { "base": "#a83c3c", "steps": 4 },
    "metal": { "base": "#8c95a6", "steps": 5, "contrast": 1.4 },  // 금속은 명암폭 큼 (rule color.material-contrast)
    "leather": { "base": "#6b4a32", "steps": 4 }
  },
  "fxColors": ["#ffffff", "#ffe08a"],
  "roleColorKey": { "warrior": "cloth_red", "rogue": "cloth_green" }  // 역할(직업·진영 등)별 대표색, 이름은 게임마다 자유
}
```
### §7.2 Spec (`data/specs/<project>/<id>.spec.json`)
```jsonc
{
  "id": "rogue",
  "bible": "sample-v0",
  "sizeClass": "character",
  "rig": "humanoid-side-v1",
  "proportions": { "headRatio": 0.28, "bulk": 0.9, "height": 30 },   // 캔버스 안 키(px)
  "parts": [
    { "bone": "head",  "shape": { "type": "ellipse", "w": 10, "h": 10 }, "material": "skin" },
    { "bone": "head",  "shape": { "type": "poly", "pts": [[-6,-2],[5,-6],[6,1],[-5,2]] }, "material": "cloth_green", "z": 1, "name": "hood" },
    { "bone": "chest", "shape": { "type": "capsule", "len": 9, "w": 8 }, "material": "leather" },
    { "bone": "handF", "shape": { "type": "line", "to": [7, 0] }, "material": "metal", "name": "dagger" }
  ],
  "animations": ["idle", "attack", "hit", "death"],
  "seed": 1
}
```
- 좌표는 뼈 로컬 좌표(px). 클로드는 이 파일만 작성·수정한다.
### §7.3 Mask 파츠 (형태가 독특한 파츠용)
```jsonc
{ "bone": "head", "shape": { "type": "mask", "origin": [3, 6],
  "rows": ["..aa..", ".aAAa.", "aAAAAa", ".aaaa."],
  "legend": { "a": { "material": "cloth_green", "shade": 1 }, "A": { "material": "cloth_green", "shade": 2 } } } }
```
- `.`=비어 있음. shade 생략 시 §6.4 자동 셰이딩. 한 mask ≤ 16×16.
### §7.4 Rules (`data/rules/default.rules.json`) — 수치와 근거 id를 함께 보관. 렌더러는 rule id를 로그로 남긴다.

## §8 리그와 애니메이션 (packages/rig)
### §8.1 Rig (`humanoid-side-v1`)
뼈: `root(골반) → spine → chest → neck → head`, `chest → upperArmF → lowerArmF → handF → weapon`, `chest → upperArmB → lowerArmB → handB`, `root → thighF → shinF → footF`, `root → thighB → shinB → footB`.
- 각 뼈: `parent, pivot[x,y], length, restAngle`. `F`=화면 앞쪽, `B`=뒤쪽. drawOrder: B사지 → 몸통 → 머리 → F사지 → weapon.
- 측면 시점, 오른쪽을 바라봄. 왼쪽은 렌더 후 수평 반전(픽셀 정확).
### §8.2 Pose / Animation
```jsonc
{ "id": "attack", "loop": false,
  "keys": [
    { "name": "ready",  "ms": 120, "pose": { "chest": {"rot": -5}, "upperArmF": {"rot": -40} } },
    { "name": "windup", "ms": 140, "pose": { "chest": {"rot": -15}, "upperArmF": {"rot": -110} } },
    { "name": "strike", "ms": 60,  "pose": { "chest": {"rot": 10}, "upperArmF": {"rot": 30}, "root": {"dx": 2} }, "fx": "slash" },
    { "name": "follow", "ms": 120, "pose": { "upperArmF": {"rot": 45} } },
    { "name": "recover","ms": 160, "pose": {} }
  ],
  "inbetween": [ { "after": "strike", "count": 1, "ease": "out" } ] }
```
- **보간 정책(rule `anim.pose-to-pose`)**: 키포즈가 기본. 사이 프레임은 `inbetween`에 명시된 키의 **바로 앞 또는 뒤에만** 생성(키 사이 균등 보간 금지). 근거: Dead Cells.
- 타격감은 프레임 수 대신 `strike`의 짧은 ms + `fx` 레이어 + `hold`(정지)로 표현.
- 기본 애니메이션 라이브러리는 `data/rigs/humanoid-side-v1.anims.json`에 두고 모든 인간형 캐릭터가 공유. Spec은 이름만 참조, 필요 시 `overrides`로 키 일부 덮어쓰기.
- 위치는 매 프레임 정수 스냅. root가 움직이지 않는 키에서 발 위치(baseline)는 고정.

## §9 QA (packages/qa)
각 검사는 `{ id, pass, value, threshold, where? }` 반환. 전체 점수 = 통과 비율, 필수 검사 하나라도 실패 시 불합격.
| id | 필수 | 내용 |
| --- | --- | --- |
| `palette.conformance` | ✔ | 바이블 팔레트 밖 인덱스 0개 |
| `alpha.binary` | ✔ | 반투명 픽셀 0개 |
| `color.budget` | ✔ | 고유 색 수 ≤ 예산 |
| `bounds.canvas` | ✔ | 모든 프레임이 캔버스 안, 여백 ≥ 1px |
| `baseline.stable` | ✔ | root 고정 키들에서 발 최하단 y 동일 |
| `anim.flicker` | ✔ | 변환이 같은 파츠 영역에서 프레임 간 색 변화 픽셀 0개 |
| `cleanup.orphans` |  | 고립 픽셀 수 ≤ 임계 |
| `cleanup.banding` |  | 서로 다른 램프 단계가 평행 계단을 이루는 구간 수 ≤ 임계 |
| `form.silhouette` |  | 같은 프로젝트 다른 캐릭터와 실루엣 IoU ≤ 0.8 |
| `read.contrast` |  | 바이블 배경색 대비 실루엣 평균 명도차 ≥ 임계 |
| `scale.consistency` |  | 같은 sizeClass 캐릭터 키 차이 ≤ ±15% |
- **컨택트 시트**: 애니메이션별 1행, 프레임을 `rules.qa.sheetScale`(기본 4)배 최근접 확대, 체커 배경 + 바이블 배경 2벌, 실패 검사 위치는 빨간 테두리. 1장 PNG + 1줄 범례 텍스트는 리포트 JSON에.

## §10 Export (packages/export)
- 패커: shelf 패킹(행 단위), 패딩 1px, 2의 거듭제곱 옵션. 프레임 순서 = 애니메이션 순서(결정론).
- 포맷
  - `aseprite-json`(기본): `frames`(hash) + `meta.frameTags`(name, from, to, direction) + `meta.size` + 프레임별 `duration`
  - `manifest`: `{ id, bible, sizeClass, pivot, anims: {name: {frames, ms[], loop}}, palette, hash }`
- Godot `.tres`는 사용자 지시 전까지 구현하지 않는다.

## §11 CLI (packages/cli)
모든 명령은 stdout에 **한 줄 JSON** `{ ok, cmd, ...요약, out? }`. 사람용 출력은 `--pretty`.
| 명령 | 동작 |
| --- | --- |
| `forge validate <spec>` | 스키마 + 참조 무결성(바이블·리그·재질·뼈 존재) |
| `forge render <spec> [--anim a,b]` | 프레임 PNG를 `out/<id>/frames/`에 |
| `forge qa <spec>` | 렌더 결과 검사 → `out/<id>/qa.json`, `out/<id>/sheet.png` |
| `forge pack <spec> [--format aseprite-json]` | `out/<id>/<id>.png`, `.json`, `manifest.json` |
| `forge build <spec>` | validate → render → qa → pack, 캐시 사용, QA 불합격이면 pack 생략(exit 2) |
| `forge build-all <project>` | 프로젝트 전체 + 교차 검사(silhouette, scale) |
| `forge palette <bible>` | 바이블 팔레트 견본 PNG |
| `forge ref analyze <png> --source <url> --license <id>` | 레퍼런스 측정값 JSON (P6) |
| `forge apply <spec> --target <adapter> [--out <dir>]` | 게임 프로젝트로 산출물 복사 (P5). 기본 어댑터 `dir`: 지정 폴더에 복사만, 엔진 무관 |
- **캐시**: 키 = SHA-256(spec + bible + rig + anims + rules + 엔진 버전). 적중 시 렌더 생략, `"cached": true`.

## §12 성능·품질 목표
- 48×48 캐릭터 4애니메이션(약 20프레임) build ≤ 1초.
- 같은 입력 2회 build 시 출력 바이트 완전 동일.
- 테스트 커버리지: core·render·qa 함수별 최소 1개 테스트, 골든 테스트 ≥ 5개.
