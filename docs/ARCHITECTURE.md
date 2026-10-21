# ARCHITECTURE — pixel-forge

> 각 Phase 문서가 "§번호"로 필요한 절만 지정한다. 지정되지 않은 절은 읽지 않는다.

## §1 목표와 설계 원칙
- **범용 툴**: 특정 게임에 묶이지 않는다. 게임마다 다른 것(해상도, 캔버스, 재질, 색 예산, 역할별 대표색, 산출물 위치)은 전부 Bible·Spec·어댑터 설정으로 받고, `packages/` 코드에는 게임 이름·경로·수치를 하드코딩하지 않는다.
- **지원 범위는 데이터로 확장한다**: 새 시점·에셋 종류·리그는 `data/` 파일과 플러그인 모듈 추가로 지원하며, 기존 렌더러 코드를 수정하지 않는다.
- 입력: 캐릭터 설계 JSON(Spec) + 아트 바이블(Bible) + 규칙(Rules) + 리그(Rig) + 파츠 라이브러리
- 출력: 스프라이트 시트 PNG + 메타 JSON + QA 리포트 + 컨택트 시트 PNG
- 원칙
  1. **AI는 설계, 엔진은 도트**: 클로드는 픽셀을 직접 찍지 않고 형태·재질·포즈를 JSON으로 기술한다. 픽셀 규칙(램프, 외곽선, 정리)은 렌더러가 강제한다.
  2. **고해상도 축소 금지**: 모든 도형은 최종 해상도에서 직접 래스터화한다. (근거: HD-2D 업체 선정 사례)
  3. **뼈대 재사용**: 애니메이션은 리그 포즈로 정의하고 캐릭터 간 공유한다. (근거: Dead Cells)
  4. **색 예산 강제**: 스프라이트당 사용 색 수를 규칙으로 제한한다. (근거: Shovel Knight, Mina the Hollower)
  5. **검수가 품질을 만든다**: 모든 빌드는 자동 QA를 통과해야 산출물로 승격된다.
  6. 품질 기준은 성공한 인디(브로테이토·뱀파이어 서바이버즈 체급): 군중 속 가독성, 전 에셋 일관성, 손맛 연출, 대량 생산. 프레임 수보다 실루엣·색 구분을 우선한다.

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
  .claude/skills/forge/SKILL.md  # P6 (클로드 코드가 자동 인식하는 위치)
```
의존 방향(단방향만 허용): `spec ← core ← rig ← render ← qa ← export ← cli`. `qa`는 `render`를 import하지 않고 프레임 배열만 받는다.

## §3 핵심 데이터 모델 (packages/core)
```ts
// 팔레트: 인덱스 0은 항상 투명
export interface Palette { colors: Uint32Array /* 0xRRGGBBAA */; names: string[] }

// 인덱스 래스터: 모든 처리의 기본 단위
export interface IndexedRaster { w: number; h: number; px: Uint8Array /* palette index, 0 = transparent */ }

// 램프: 한 재질의 명암 단계. index[0]=가장 어두움
export interface Ramp { id: string; indices: number[] /* palette indices, dark→light */; outline: number /* 재질 전용 외곽선 톤 (램프 밖) */ }

// 보조 버퍼 (렌더 중간 단계)
export interface ZoneBuffer { w: number; h: number; material: Uint8Array; shade: Uint8Array; depth: Uint8Array; part: Uint16Array }
```
- `material`: 재질 id(0=비어 있음), `shade`: 램프 단계, `depth`: 그리기 깊이(앞/뒤 판정), `part`: 파츠 id(외곽선·깜빡임 검사용)
- 최종 색 = `ramp[material].indices[shade]` → IndexedRaster로 확정(resolve)

## §4 색과 램프 (packages/core/color)
- 색 연산은 **OKLab/OKLCh**에서 수행, 결과를 sRGB로 변환 후 팔레트에 등록.
- 색상 회전: 항상 **최단 각도 방향**으로 목표 hue를 향해 단계당 `hueShift`°씩 이동하고, 목표 hue를 넘어가지 않는다.
  - 단, 기준 hue에서 목표 hue까지의 최단 경로가 `rules.ramp.avoidHueBand`(기본 OKLCh h 115°~165°, 초록 대역)를 지나고 기준색이 그 대역 밖이면 **반대 방향**으로 돈다(목표는 넘지 않음). 밝은 쪽·어두운 쪽 각각 독립 판정. 예: gold(h≈88°) 그림자는 260°로 가는 최단 경로가 초록을 지나므로 빨강 쪽으로 돈다.
- 명도 범위: 램프 단계의 L은 `rules.ramp.minL`~`maxL`(기본 0.18~0.93)로 클램프한다.
- 색역 맞춤: OKLCh→sRGB 결과가 범위 밖이면 L과 h는 고정하고 C만 이분 탐색으로 줄여 범위 안에 넣는다(최대 20회).
- 최종 hex: 채널별 반올림 후 0~255 클램프.
- 예약 색 = `bible.fxColors` + `outline.globalColor`. 모든 재질 색(외곽선 톤 포함)은 예약 색과 OKLab 거리 ≥ 0.03, 다른 재질 색·같은 램프의 다른 단계와도 ≥ 0.03.
  - 충돌하면 밝은 쪽(기준색 포함)은 L을 0.02씩 낮추고 어두운 쪽·외곽선 톤은 올린다(최대 5회). 그래도 충돌이면 `ForgeError("palette.collision")`(재질·단계 포함).
  - 배치 순서(결정론): 재질 키 정렬 → 각 재질에서 기준색 → 밝은 쪽 바깥부터 안쪽 → 어두운 쪽 바깥부터 안쪽 → 외곽선 톤. 바깥 단계가 먼저 자리를 잡으므로 밀려나는 쪽은 안쪽 단계이고 명도 순서가 유지된다.
  - 의도적 공유는 재질 정의에 `"shareWith": "<재질>"`이 있을 때만: 두 재질 사이는 거리 검사를 하지 않고, 같은 hex는 인덱스를 공유한다.
- 재질별 외곽선 톤: 램프 밖 전용 1색. `L = ramp[0].L − 0.08`, `C = ramp[0].C × 0.6`, hue는 그림자 방향으로 한 단계 더.
- 램프 생성 `makeRamp(base, rules.ramp)`:
  - 단계 수 `steps`(기본 5), 기준색은 가운데 단계
  - 밝아질수록 명도 +ΔL, 색상(hue)을 `warmHue`(기본 70°, 노랑) 방향으로 `hueShift`°씩 이동
  - 어두워질수록 명도 −ΔL, 색상을 `coolHue`(기본 260°, 파랑) 방향으로 이동, 채도는 가운데 단계에서 최대 → 양끝으로 `chromaFalloff`만큼 감소
  - 근거: Slynyrd Pixelblog 1(HSB 팔레트), rule `color.ramp.hue-shift`
- 전역 팔레트 = 바이블의 모든 재질 램프 + 외곽선색 + 이펙트색. **바이블에 없는 색은 렌더러가 만들 수 없다.**
- 색 예산 검사: 프레임 묶음 전체에서 **실제로 쓰인** 고유 색 수(외곽선 톤·fx 포함) ≤ `bible.colorBudget[sizeClass]`. 근거: SNES 스프라이트 팔레트 15색+투명, 보스는 팔레트 2개.

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
2. **파츠 배치**: Spec의 파츠를 뼈에 부착, z순서 정렬(`rig.drawOrder` + 파츠 `z` 보정). **렌더러는 뼈 이름을 절대 참조하지 않고** `depthLayer`·`drawOrder`만 쓴다
3. **래스터화**: 파츠별 도형 → ZoneBuffer에 depth 비교로 기록 (`depthLayer` back < mid < front 순으로 `depth`가 작다). 캔버스 배치: 루트 관절은 가로 가운데, 가장 아래 픽셀은 바닥에서 2px 위(외곽선 1px + 빈 줄 1px)
4. **셰이딩**: 픽셀별 `lambert = max(0, n·L)` + `ambient` → `rules.shade.thresholds`로 단계 양자화 → shade 기록
   - 뒤쪽 보정: `depthLayer = "back"`인 뼈에 붙은 파츠는 `shade -= rules.shade.backLimbDarken`(기본 1) — 깊이감 (rule `form.depth-cue`)
5. **클러스터 정리**: 같은 재질 안에서 크기 < `rules.cleanup.minCluster`(기본 3px)인 shade 섬을 주변 최빈 shade로 병합 → 노이즈·필로우 셰이딩 방지
   - 4~5는 **파츠마다 가려지기 전 전체 모양에서** 따로 한 뒤 합성한다. 다른 파츠가 움직이거나 가려도 이 파츠 음영이 바뀌지 않게(anim.flicker)
   - 면적 < `rules.budgetFit.smallPartArea`(12px)인 파츠는 램프를 3단계(어둠·기본·하이라이트)로 축소 (rule `color.budget-fit`)
6. **해석(resolve)**: material+shade → 팔레트 인덱스 → IndexedRaster
7. **외곽선**: `rules.outline.mode`
   - `selout`(기본): 실루엣 바깥 1px. 어두운 면은 인접 재질의 **외곽선 톤**(`ramp.outline`), 광원을 향한 면(법선·L > `seloutLitThreshold`)은 `ramp[0]`. 그림자 색과 외곽선이 같은 색이 되지 않게 한다
   - `dark`: 전역 외곽선색 단일
   - `none`: 바깥 외곽선 없음
   - 얇은 획 (rule `form.outline-thin`): 두께 1px 이하 파츠(1px `line` 등)는 바깥 외곽선을 그리지 않고, 획 자체를 그 재질의 외곽선 톤으로 칠한다. 칼날 하이라이트 1px만 허용. 1px 무기 양쪽에 평행한 외곽선이 붙어 두 줄로 보이는 문제 방지
   - 손에 든 파츠 (rule `form.held-min-width`): `held=true` 파츠는 두께 `rules.held.minWidth`(2px) 이상이어야 한다(rest에서 판정, 미달 → `spec.held-too-thin`). 1px는 `decorative=true`만. held 파츠는 얇은 획 처리·작은 섬 병합·고립 정리에서 빠진다(눈처럼 보호). 1px 무기가 외곽선 톤으로만 칠해져 배경에 묻히던 문제(P4 보정 조사) 방지
   - 모드는 `bible.outline.mode`가 `rules.outline.mode`보다 우선한다(게임별 화풍)
   - 내부선: 서로 다른 파츠가 겹치고 depth 차이가 있으면 뒤 파츠 쪽 경계 1px를 해당 램프 0단계로
7.5 **눈** (rule `form.face`): `spec.eyes` 위치에 눈을 찍고 정리 단계에서 보호. 리그 `eyes.count = 2`(3/4)면 먼 쪽 눈 1px을 화면 앞쪽 `spacing`만큼, 머리 파츠 끝에서 `rules.face.farEyeGap` 이상 안쪽에
8. **정리**: 고립 픽셀 제거(8-이웃 중 같은 색 0개), 1px 획의 L자 모서리 제거. 고립 정리는 4~5와 함께 **파츠마다 가려지기 전 전체 모양에서** 한다 — 다른 파츠의 움직임·가림·내부선이 정리 결과로 번지지 않게(anim.flicker)
6.5 **색 예산 맞춤** (rule `color.budget-fit`, 실행은 8 다음): 고유 색 수 > `bible.colorBudget[sizeClass]`이면 같은 재질에서 사용 픽셀이 가장 적은 단계를 OKLab으로 가장 가까운 사용 중 단계로 병합, 예산 이하까지 반복. 외곽선 톤·눈 색·예약 색은 제외. 동률이면 재질 키 순 → 단계 인덱스 낮은 쪽. 병합 내역은 렌더 결과 `meta.budget`에 기록(QA 리포트에 표시). 외곽선 톤도 예산에 들어가므로 외곽선·눈을 그린 뒤 센다
9. **검증 훅**: 팔레트 밖 인덱스, 반투명 알파가 없음을 assert (개발 모드)

## §7 DSL — 입력 JSON 스키마 (packages/spec)
### §7.1 Bible (`data/bibles/*.bible.json`)
```jsonc
{
  "id": "sample-v0",
  "internalResolution": [320, 180],      // 선택: 대상 게임의 내부 해상도(QA 가독성 검사용)
  "view": "side",                        // "side" | "topdown" | "iso" — 지금은 side만 구현
  "directions": 1,                       // 1 | 4 | 8. side = 1 + 좌우 반전
  "sizeClasses": { "character": [48, 48], "smallMonster": [32, 32], "boss": [96, 96] },  // 이름 자유, [w, h] px
  "defaultRig": "humanoid-34-v1",        // Spec이 rig를 생략하면 이 리그
  "pivot": "bottom-center",              // 발밑 중앙
  "light": { "dir": [-0.6, -0.7, 0.4], "ambient": 0.15 },
  "outline": { "mode": "selout", "globalColor": "#1a1020" },
  "colorBudget": { "character": 15, "smallMonster": 7, "boss": 30 },  // sizeClasses와 같은 키. SNES 스프라이트 팔레트 15색+투명, 보스는 팔레트 2개
  "materials": {                          // 재질 → 램프 기준색
    "skin": { "base": "#d9a07a", "steps": 4 },
    "cloth_red": { "base": "#a83c3c", "steps": 4 },
    "metal": { "base": "#8c95a6", "steps": 5, "contrast": 1.4 },  // 금속은 명암폭 큼 (rule color.material-contrast)
    "metal_trim": { "base": "#8c95a6", "steps": 3, "shareWith": "metal" },  // 의도적 색 공유는 shareWith로만
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
  "kind": "character",                   // "character" | "item" | "tile" | "fx" | "ui" — P2~P4는 character만 구현
  "bible": "sample-v0",
  "sizeClass": "character",
  "rig": "humanoid-34-v1",              // 생략하면 bible.defaultRig
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
- 파츠 위치: `anchor`(`joint` | `mid` 기본 | `end`) 지점에서 `at`[x, y]만큼 뼈 로컬 좌표로 옮긴 픽셀이 도형 앵커(§5)가 된다.
- 도형 축: `orient: "bone"`(기본)은 도형 로컬 x축이 뼈 방향이라 위로 선 뼈(몸통)에서는 `len`/`w`가 세로다. 머리·모자·벨트처럼 화면 축 그대로 그릴 파츠는 `orient: "world"`. world 파츠도 포즈가 뼈를 rest보다 더 돌린 만큼은 따라 돈다(쓰러질 때 망토·로브가 세로로 남지 않게).
- 뼈 로컬 +y: 위로 선 뼈에서는 화면 앞(+x), 아래로 향한 뼈에서는 화면 뒤(−x).
- `proportions.height`: 리그 전체(관절 위치·뼈 길이)를 `rig.baseHeight` 대비 이 비율로 축척한다. 파츠 크기는 축척하지 않는다. `headRatio`·`bulk`는 지금은 기록용(P6 레퍼런스 비교).
- `role`(선택): `bible.roleColorKey`의 키.
- `eyes`(선택, rule `form.face`): `{ bone, pos: [x, y], size: 1|2, color: "<재질>:<단계>" }`. 위치는 뼈 중간점에서 화면 축으로 `pos`. `size`는 세로 픽셀 수. 3/4 리그는 먼 쪽 눈이 자동으로 붙는다.
- 역할색 지침: `roleColorKey` 재질이 실루엣의 20% 이상(QA `read.role-color`). 부족하면 망토·휘장 같은 큰 파츠를 그 재질로.
- `kind`가 아직 구현되지 않은 종류면 `ForgeError("spec.kind-not-implemented")`. `sizeClass`는 바이블 `sizeClasses`의 키여야 한다.
- 작성 지침: 캐릭터당 재질 3~4개 권장. 색 예산 초과 시 재질의 `steps`를 줄이거나 재질을 합친다.
### §7.3 Mask 파츠 (형태가 독특한 파츠용)
```jsonc
{ "bone": "head", "shape": { "type": "mask", "origin": [3, 6],
  "rows": ["..aa..", ".aAAa.", "aAAAAa", ".aaaa."],
  "legend": { "a": { "material": "cloth_green", "shade": 1 }, "A": { "material": "cloth_green", "shade": 2 } } } }
```
- `.`=비어 있음. shade 생략 시 §6.4 자동 셰이딩. 한 mask ≤ 16×16.
### §7.4 Rules (`data/rules/default.rules.json`) — 수치와 근거 id를 함께 보관. 렌더러는 rule id를 로그로 남긴다.

## §8 리그와 애니메이션 (packages/rig)
### §8.1 Rig (`humanoid-side-v1`, `humanoid-34-v1`)
뼈: `root(골반) → spine → chest → neck → head`, `chest → upperArmF → lowerArmF → handF → weapon`, `chest → upperArmB → lowerArmB → handB`, `root → thighF → shinF → footF`, `root → thighB → shinB → footB`.
- 각 뼈: `parent, pivot[x,y], length, restAngle, depthLayer`. `depthLayer`는 `"back" | "mid" | "front"`(이 리그: `*B` 사지=back, 몸통·머리=mid, `*F` 사지·weapon=front). 이름의 `F`/`B`는 사람이 읽기 위한 관례일 뿐, 렌더러는 `depthLayer`·`drawOrder`만 본다.
- drawOrder: back 사지 → 몸통 → 머리 → front 사지 → weapon.
- 측면 시점, 오른쪽을 바라봄. 왼쪽은 렌더 후 수평 반전(픽셀 정확).
- `humanoid-34-v1`: 몸통이 화면 쪽으로 약 30° 돈 측면 3/4. 같은 뼈 구조에 어깨 피벗만 앞 2px·뒤 3px로 벌려 양 어깨가 보이고, 뒤팔(back)은 몸통 뒤로 일부 노출. `metrics.chestWidth`(Spec 작성 참고값) 10 = 측면 대비 약 1.6배. `eyes: {count: 2, spacing: 3}`.
- `restAngle`은 차렷, `restPose`(뼈별 rot·dx·dy)는 **전투 대기 자세**까지의 변화량. `solveRig`가 항상 적용하고 P4 포즈는 그 위에 더한다. 34 리그의 restPose: 앞다리 앞·뒷다리 뒤(발 간격 4~6px), 무릎 굽힘, 무기 팔이 몸통 앞으로(손이 몸통 실루엣 밖).
- `humanoid-side-v1`은 완전 측면 게임용으로 유지.
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
- 애니 렌더: 모든 프레임은 rest 프레임 원점을 쓰고(발밑 고정), 색 예산은 rest + 전 프레임을 모아 한 번에 맞춘다(프레임마다 색이 바뀌지 않게). fx는 anims 파일 `fx`에 데이터로 정의(`flash`, `arc`), 좌향은 우향의 flipX.
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
| `form.held-visible` | ✔ | 모든 프레임에서 held 파츠의 보이는 픽셀(외곽선 톤·전역 외곽선색 제외) ≥ rest 픽셀 × `heldVisibleMin`(0.6), 손 파츠(부착 뼈·부모 뼈의 held 아닌 파츠)와 8-연결로 맞닿음 |
| `cleanup.orphans` |  | 고립 픽셀 수 ≤ 임계 |
| `cleanup.banding` |  | 서로 다른 램프 단계가 평행 계단을 이루는 구간 수 ≤ 임계. 띠 = 같은 램프 A\|B\|C(단계 단조)에서 1px 폭 B, 8-연결 2px 이상 이어진 것만 1구간 |
| `form.silhouette` |  | 같은 프로젝트 다른 캐릭터와 실루엣 IoU ≤ 0.8 |
| `read.contrast` |  | 바이블 배경색 대비 실루엣 평균 명도차 ≥ 임계 |
| `scale.consistency` |  | 같은 sizeClass 캐릭터 키 차이 ≤ ±15% |
| `form.face-clear` |  | 머리 뼈(`spec.eyes.bone`) 파츠 면적 중 다른 파츠에 가려진 비율 ≤ `faceCoverMax` |
| `form.detail-min` |  | 같은 재질 8-연결 영역 중 `detailMinPx` 미만 조각 수 ≤ `detailMaxCount` (외곽선·눈 제외) |
| `read.role-color` |  | roleColorKey 재질(램프+외곽선 톤) 픽셀 ≥ 불투명 픽셀의 `roleColorMin` |
- `read.contrast`의 명도는 OKLab L, 실루엣 = 모든 불투명 픽셀. `form.silhouette`은 발밑 가운데를 맞춘 IoU.
- 프레임 1장 기준 임계값(`cleanup.orphans`·`cleanup.banding`·`form.detail-min`)은 애니 전 프레임 중 가장 나쁜 프레임으로 판정한다. `anim.flicker`는 외곽선·내부선·눈·fx 표시 위치를 뺀다. `cleanup.orphans`는 표시 위치와, 이웃에 표시 위치가 있는 픽셀(선·눈이 같은 색 이웃을 덮어 생긴 고립)을 세지 않는다(사용자 결정 A).
- **컨택트 시트**: 애니메이션별 1행, 프레임을 `rules.qa.sheetScale`(기본 4)배 최근접 확대, 체커 배경 + 바이블 배경 2벌, 실패 검사 위치는 빨간 테두리. 1장 PNG + 1줄 범례 텍스트는 리포트 JSON에.

## §10 Export (packages/export)
- 패커: shelf 패킹(행 단위), 패딩 1px, 2의 거듭제곱 옵션. 프레임 순서 = 애니메이션 순서(결정론).
- 포맷
- 프레임 이름 규칙: `<anim>_<dir>_<n>` (side 시점은 `dir = "r"`, n은 0부터). frameTags 이름은 `<anim>_<dir>`.
  - `aseprite-json`(기본): `frames`(hash) + `meta.frameTags`(name, from, to, direction) + `meta.size` + 프레임별 `duration`
  - `manifest`: `{ id, bible, sizeClass, pivot, anims: {name: {frames, ms[], loop}}, motion, palette, hash }`
    - `motion`: 엔진이 실행할 절차 애니 힌트 `{ bob: {px, ms}, squash: {x, y, ms}, hitFlash: {ms} }`. 기본값은 `bible.motion`, Spec `motion`이 키 단위로 덮어쓴다. 툴은 값만 기록하고 프레임을 만들지 않는다
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
| `forge crowd <project> [--count 50] [--seed 1]` | 바이블 배경 위 실제 크기(1배) 무작위 군중 시트 + 2배 확대본 → `out/<project>/crowd.png`, `crowd@2x.png` (QA `crowd.readability`) |
| `forge variants <spec> --rarity --palette-swap --part-swap` | 아이템 변형 생성(P7) |
| `forge palette <bible>` | 바이블 팔레트 견본 PNG |
| `forge ref analyze <png> --source <url> --license <id>` | 레퍼런스 측정값 JSON (P6) |
| `forge apply <spec> --target <adapter> [--out <dir>]` | 게임 프로젝트로 산출물 복사 (P5). 기본 어댑터 `dir`: 지정 폴더에 복사만, 엔진 무관 |
- **캐시**: 키 = SHA-256(spec + bible + rig + anims + rules + 엔진 버전). 적중 시 렌더 생략, `"cached": true`.
- **경로 안전**: 경로를 받는 명령(palette, apply, ref, palette import)은 `resolveInside(base, path)`로 정규화하고 기준 폴더 밖(`../`, 절대 경로)이면 `ForgeError("io.path-escape")`.

## §12 성능·품질 목표
- 48×48 캐릭터 4애니메이션(약 20프레임) build ≤ 1초.
- 같은 입력 2회 build 시 출력 바이트 완전 동일.
- 테스트 커버리지: core·render·qa 함수별 최소 1개 테스트, 골든 테스트 ≥ 5개.
