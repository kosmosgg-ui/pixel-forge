# 지시문 G1 — 「성검의 맹세」 게임에 캐릭터 도트 본격 적용 (사용자 승인 2026-10-22)

대상 저장소: **kosmosgg-ui/seonggeom** (pixel-forge 아님). 작업 위치: `outputs/geometry-prototype/` (Godot 4.7.2 프로젝트).
기준 브랜치: `feature/sf-004t-reference-art-experiment` (SHA c53494f… — Windows 데모 빌드 원본). 새 브랜치: `feature/g1-actor-sprites`.
이 문서는 기획 세션이 코드·실행 파일을 직접 확인하고 쓴 것이다. 아래 "코드 사실"은 c53494f 기준 확인값이다. 다르면 멈추고 보고.

---

## 0. 이 저장소의 규칙 (가장 먼저)

1. `AGENTS.md`를 읽고 따른다. 이 저장소의 운영 원칙은 Codex용으로 쓰였지만 **에이전트 공통 규칙**이다. 특히:
   - `outputs/game-production/16_현재상태와_개발일지.md`를 먼저 확인, 작업 단위 종료마다 상태·재개 메모 갱신
   - 기존 승인 사양 우선, 제안을 확정으로 오인 금지
   - P14(재사용·탐색 최소화), P15(위험도 기반 검사, 저장·진행 보호 검증 생략 금지)
   - 기능 검증 / 실제 플레이 검증 / 경험 검증 구분 — 자동 검사만으로 "재미·가독성 검증 완료" 보고 금지
2. 저장소 루트에 `CLAUDE.md`를 만든다(10줄 이내): "AGENTS.md가 단일 기준. 아래는 Claude Code 전용 보충"만 적고, 보충은 ① 브랜치·Draft PR로만 작업, main·기존 PR 브랜치 직접 수정 금지 ② 병합·유료 구매·정상 에셋 교체는 사용자 승인 ③ Godot 실행 파일 경로는 환경변수 `GODOT_BIN`.
3. 작업 전 기준 SHA를 16번 문서에 기록. 종료 시 `git status` clean, 변경 파일 목록, 실행 명령·결과 기록, push, Draft PR.

## 1. 확정된 사용자 결정 (바꾸지 않는다)

| 항목 | 결정 |
| --- | --- |
| 아트 방향 | 사실 비례(약 6등신) 애니풍 도트. 기획서 v1.2 방향 유지 |
| 제작 방식 | GPT 애니 일러스트 → pixel-forge가 도트 변환 → `art/candidates/`에 후보 → Gate B → 사용자 Gate C → 정식 경로 |
| 화면 배율 | **간이 방식**: 뷰포트 1280×720·`canvas_items` 그대로. 캐릭터 그림만 **정수 2배**(nearest), 그림 위치는 **짝수 픽셀로 스냅**. 640×360 전환·월드 좌표 변경은 하지 않는다 |
| 크기(1배 논리) | 주인공 키 64px(셀 64×80, 발 앵커 (32,78)) / 일반 적 52px(셀 64×64, 발 (32,62)) / 보스 96px(셀 128×128, 발 (64,126)). 화면에서는 2배 |
| 방향 | 주인공·보스: down(front)·up(back)·right(side) + left = right 반전. 일반 적: right + 반전 |
| 게임 코드 담당 | Claude Code (Codex 아님) |

## 2. 코드 사실 (c53494f 확인값)

- 모든 미션 장면의 그리기 기반은 `demo/com_001.gd`. `ch1_01.gd`, `ch1_02.gd`, `class_trial/demo_080.gd`가 이를 상속하고, `pro_01/pro_01.gd`는 `ch1_02.gd`를 상속한다.
- 좌표 변환: `com_001.gd:77 func world(pos):return pos*(2.0/3.0)`.
- 주인공 도형: `com_001.gd:101-104` — `draw_circle(world(session.hero),10,color)`, 회피 무적이면 노란색(`session.dodge.invulnerable()`), 방향선 `session.dodge.last_direction`, 필살기 강조 `session.ultimate_phase=="EMPHASIS"`.
- 적 도형: `com_001.gd:97-100` — `session.enemies`의 `pos, hp, radius, role, mode`. `ch1_02.gd:_draw`가 보스(`e.boss`, 주황 사각형)·오크(`e.role=="D040_ORC"`)·패턴 예고(`e.mode in ["telegraph","active"]`, `e.pattern_spec`)를 추가로 그린다.
- 공격 표시: `session.visuals`(부채꼴·선·원 효과, `pos, aim, range, angle, shape`), `session.player_shots`.
- 전투 세션 필드: `combat_session.gd` — `dodge`(dodge_controller: `active, elapsed, direction, last_direction`), `ultimate_phase`(READY/PREPARE/EMPHASIS/RECOVERY), `hit_events`, `hp`, `paused`, `state`.
- 기존 시험 코드: `demo/visual/demo_100/sera_preview_visual.gd` — PRO-01에만 붙고 640×240·idle 4·run 6 고정, 이동 방향은 위치 차이로 판정. **G1에서 대체**한다(삭제하지 말고 deprecated 주석 + 새 계층으로 교체, 테스트 `tests/art_100b_integration.gd`는 새 계층 기준으로 갱신).
- 기획 세션 시험 빌드(저장소 미반영)에서 위 시험 코드에 `--sera-scale=2`만 추가해 2배 표시가 정상 동작함을 확인했다(Godot 4.7.2, 오류 0).

## 3. 만들 것

### 3.1 ActorView — 공용 캐릭터 표시 계층 (`demo/visual/actor_view/`)
- `actor_view.gd` (Node2D): 매 프레임 `session`을 **읽기만** 한다. 전투·미션·저장 데이터를 쓰지 않는다(기획서 5.1 계약). 쓰기 시도가 없음을 테스트로 고정.
- `actor_sprite.gd`: 캐릭터 1개 = Sprite2D 1개(region 방식, 시트 1장). AnimatedSprite2D/SpriteFrames 대신 region을 쓰는 이유: 매니페스트가 시트 좌표를 직접 주고, 적 다수에서 리소스 생성이 적다. 성능 측정(3.6) 후 필요하면 교체 제안만.
- 붙이는 곳: `com_001.gd`의 `_ready`에서 ActorView를 자식으로 추가(한 곳만 고치면 4개 미션 장면 전부 적용). `pro_01.gd`의 기존 시험 노드 생성은 제거.
- 도형과의 관계: 해당 캐릭터의 에셋이 **로드 성공**한 경우에만 `com_001._draw`/`ch1_02._draw`가 그 캐릭터의 원·사각형을 건너뛴다(플래그 조회). 에셋이 없거나 잘못되면 지금 도형 그대로(게임이 깨지지 않음).
- 디버그 토글: 사용자 인자 `--debug-shapes`면 그림 위에 원래 도형(히트 반경)도 겹쳐 그림. F3 같은 키 할당은 하지 않는다(조작 계약에 없는 키 추가 금지).
- 공격 예고 범위(노란 원·부채꼴·돌진 선), 투사체, 회복 아이템, 방어 대상, 장애물은 **지금 도형 그대로** 둔다(가독성).

### 3.2 매니페스트 로더 (`demo/visual/actor_view/actor_manifest.gd`)
- 입력: `art/actors/<assetId>/<assetId>_manifest.json` + `_sheet.png`. 형식은 기존 `art/demo_100/characters/sera/sera_manifest.json`을 확장한 것(pixel-forge `godot-rowsheet` 출력과 동일):
  ```jsonc
  {
    "assetId": "hero_sera", "version": "...", "quality": "candidate|approved",
    "frame_size": [64, 80], "sheet_size": [W, H], "anchor": [32, 78],
    "display_scale": 2,
    "rows": {"down": 0, "up": 1, "right": 2},          // 방향 → 행
    "mirror": {"left": "right"},
    "animations": {                                      // 동작 → 시작 열·프레임 수·fps·반복
      "idle":  {"start_column": 0,  "frames": 4, "fps": 4,  "loop": true},
      "walk":  {"start_column": 4,  "frames": 6, "fps": 10, "loop": true, "stride_px": 24},
      "attack":{"start_column": 10, "frames": 5, "fps": 14, "loop": false},
      "hit":   {"start_column": 15, "frames": 3, "fps": 16, "loop": false},
      "dodge": {"start_column": 18, "frames": 3, "fps": 14, "loop": false},
      "death": {"start_column": 21, "frames": 4, "fps": 8,  "loop": false, "rows_only": ["right"]},
      "ultimate":{"start_column": 25,"frames": 6, "fps": 12, "loop": false, "rows_only": ["right"]}
    },
    "provenance": { /* data/12_assets_audio_tools.json의 provenanceFields 11개 */ },
    "qa": { "warnings": [] }
  }
  ```
- 검증(로드 시 1회): 시트 크기 = 열 수×셀, 모든 동작이 시트 안, 앵커가 셀 안, `quality` 값. 실패하면 경고 1줄 로그 + 도형 대체. 하드코딩 크기 금지(기존 `get_size()==Vector2(640,240)` 같은 비교 제거).
- 어느 캐릭터에 어느 에셋을 쓰는지: `data/actor_bindings.json` 하나(주인공·적 role·보스 id → assetId). 코드에 이름 하드코딩 금지.
- 로드 경로 우선순위: 기본은 정식 경로 `art/actors/`. 사용자 인자 `--art-candidates`면 `art/candidates/`를 먼저 본다(Gate C 검수용). 정식 경로 승격은 사용자 승인 후 파일 복사로만.

### 3.3 동작 상태 판정 (`actor_state.gd`, 순수 함수 + 테스트)
주인공:
| 상태 | 판정(읽기 전용) | 우선순위 |
| --- | --- | --- |
| death | `session.hp <= 0` | 1 |
| ultimate | `session.ultimate_phase in ["PREPARE","EMPHASIS"]` | 2 |
| hit | 직전 프레임보다 `session.hp` 감소 → 0.18초 | 3 |
| dodge | `session.dodge.active` | 4 |
| attack | 이번 프레임 `session.visuals`에 주인공 공격 효과가 **새로** 생김(개수 증가·새 항목) → 동작 1회 재생 | 5 |
| walk | 표시 위치 이동량 > 0.1px/프레임 | 6 |
| idle | 그 외 | 7 |
- 방향: walk·dodge는 이동 방향, attack은 효과의 `aim`, 그 외는 마지막 방향 유지. 4방향 결정은 |x|와 |y| 비교(기존 시험 코드 방식), left는 right 반전.
- 일시정지·강화 선택(`session.paused`, `state=="upgrade"`)이면 프레임 정지.
- 원샷 동작(attack·hit·dodge)은 끝나면 상위 상태로 복귀. 같은 동작 재발생 시 처음부터.
- 시간 기준은 `session.time`(게임 시간). 실제 시계 사용 금지(재현성·일시정지).

적:
| 상태 | 판정 |
| --- | --- |
| death | `e.hp <= 0`이 된 순간부터 death 1회 재생 후 사라짐(전투 데이터는 이미 제거될 수 있으므로 ActorView가 마지막 위치를 기억) |
| attack | `e.mode == "active"` |
| telegraph | `e.mode == "telegraph"` → attack 첫 프레임 정지(예고 도형은 그대로 그려짐) |
| hit | hp 감소 → 0.12초 흰색 플래시(셰이더 없이 `modulate`로) |
| walk/idle | 이동량 |
- 적 방향: 주인공 쪽을 바라봄(x 비교로 반전). 적은 right 1행만.
- 적 식별: `e`에 고유 id가 없으면 ActorView가 등장 순서로 내부 id를 붙여 추적(전투 데이터에 쓰지 않음).

### 3.3b 걷기 속도 자동 맞춤 (발 미끄러짐 방지, 사용자 승인 19:26)
- 문제: 걷기 그림의 보폭과 실제 이동 속도가 다르면 발이 미끄러져 보인다. 서바이버라이크에서 가장 눈에 띄는 어색함.
- 매니페스트 walk에 `stride_px`(1배 논리 픽셀, 한 걸음 길이)를 둔다. 첫 세라 후보 실측값: **24**(접지 프레임 앞뒤 발 간격 20~29px 평균, 기획 세션 측정).
- 재생 속도: `fps = frames × 화면이동속도(px/s) ÷ (2 × stride_px × display_scale)`. 화면이동속도는 표시 위치 변화량으로 잰다(전투 속도 값 읽기 금지 — 버프·감속까지 자동 반영).
  - 확인값: 기본 이동 속도 240(`data/03_combat.json`) × 2/3 = 화면 160px/s → 6 × 160 ÷ (2 × 24 × 2) = **10fps**(현재 매니페스트 값과 일치).
- 안전 범위: 기본 fps의 0.5~1.6배로 제한. 이동량이 기본 속도의 25% 미만이면 idle.
- 위상 유지: 속도가 바뀌어도 프레임을 처음으로 되돌리지 않고 누적 위상(0~1)을 이어서 진행(걸음이 튀지 않게).
- 적도 같은 규칙(적 매니페스트에 `stride_px` 없으면 고정 fps).
- 테스트: 속도 0.5·1·1.5배에서 fps 계산, 위상 연속성, 상한·하한.

### 3.8 타격 연출 (그림만으로 부족한 타격감 보강, 사용자 승인 19:26)
모두 **표시 전용**이다. 전투 시간·판정·데미지를 바꾸지 않는다(시뮬레이션은 그대로 진행). 수치는 `data/actor_view_config.json` 한 곳에 두고 코드 하드코딩 금지.
| 연출 | 조건(읽기 전용) | 기본값 |
| --- | --- | --- |
| 피격 번쩍임(주인공·적) | hp 감소 | 흰색 `modulate` 0.08초 + 원래 색 복귀 0.06초 |
| 표시 정지(히트스톱) | 주인공 공격이 적 hp를 깎은 프레임 | **애니메이션만** 0.05초 정지(위치·시뮬레이션은 진행). 연속 발생 시 0.2초에 1회로 제한 |
| 밀림 표현 | 적 피격 | 공격 방향으로 그림만 2px(1배 기준 1px) 0.06초 이동 후 복귀 |
| 화면 흔들림 | 주인공 피격, 보스 패턴 적중, 필살기 EMPHASIS | 카메라 오프셋 최대 2px·0.12초 감쇠. `screen_shake` 끄기 옵션(기본 켬, 접근성) |
| 적 사망 | hp 0 | 흰색 번쩍임 1회 → death 애니메이션(없으면 0.25초 페이드) → 사라짐 |
| 공격 예비 동작 | 적 `mode=="telegraph"` | attack 첫 프레임 정지(3.3 표 그대로) + 예고 도형 유지 |
| 베기 궤적 | `session.visuals`의 주인공 공격 효과 | **이펙트 시트가 있으면** 효과의 `aim`·`range`·`angle`에 맞춰 회전·크기 맞춤 재생, 없으면 지금 반투명 부채꼴 그대로 |
- 이펙트 시트는 pixel-forge 후속 단계(P10 예정: 베기 궤적 3종·타격 섬광·먼지·사망 연기, 직접 생성 모드 — AI 공개 대상 아님)에서 `art/candidates/fx_*`로 들어온다. G1에서는 로더·재생 자리만 만들고 없을 때 대체 동작을 검증.
- 테스트: 히트스톱 중 `session.time`·위치 진행 확인(시뮬레이션 불변), 흔들림 끄기 옵션, 연속 피격 제한.
- 캡처(3.6)에 "피격 직후·적 사망 직후·필살기 강조" 3장 추가.

### 3.4 위치·크기·겹침
- 그림 위치 = `world(pos)`에서 앵커만큼 위로, **짝수 픽셀 스냅**(`floor(x/2)*2`). 2배 표시라 1배 픽셀 격자가 화면 2px 격자와 맞아야 덩어리가 흔들리지 않는다.
- 겹침: 모든 캐릭터를 y 기준 정렬(`y_sort_enabled` 또는 `z_index = int(world_y)`). UI(CanvasLayer)보다 아래.
- 발밑 그림자: 반투명 검정 타원 1개(셀 너비의 50%, 높이 6px, 알파 0.35). 도트 규칙의 "알파 0/255"는 스프라이트 시트에만 적용되고 그림자 노드는 예외 — 주석으로 명시.
- 히트 반경은 바꾸지 않는다. `--debug-shapes`로 그림과 반경의 어긋남을 캡처해 보고만.

### 3.5 데이터·문서 갱신 (사용자 승인 결정 반영)
- `data/15_decision_register.json`에 3건: ART-PIPE-GPT(제작 방식), DISPLAY-SPRITE-2X(간이 배율), DIR-SPLIT(방향 분리, "추후 재검토"). 이전 결정은 삭제하지 않고 superseded 표시.
- `data/12_assets_audio_tools.json`: `style.genre` → `anime_proportional_pixel`(이전 값 `style.previousGenre`), `actorPipeline.workingChoice` → `gpt_illustration_plus_pixelforge_import`(기존 parts는 `deprecated` 아래로), assetRows 크기를 1절 값으로(`logicalHeight`, `canvas`, `displayScale: 2`).
- 기획서 문서(docs의 통합 기획)에서 "표시 96×112" → "1배 64×80, 화면 2배".
- `art/candidates/README.md`: 후보 폴더 규칙(quality=candidate, 정식 경로 승격은 사용자 승인).

### 3.6 검증 (Gate B)
- 단위 테스트(headless): 매니페스트 검증 성공·실패 6케이스, 상태 판정 표의 각 행, 짝수 스냅, ActorView가 session을 바꾸지 않음(전후 해시 동일).
- 회귀(P15 필수): 기존 저장·진행·미션 결과 테스트 전부(`tests/` 기존 스위트) — 결과 줄 첨부. 저장 schema1 파일 해시 불변.
- 실제 화면 캡처(Xvfb + 가상 키 입력, 기획 세션에서 동작 확인한 방식): PRO-01, CH1-01, CH1-02, 전직 체험 각각 — 4방향 이동, 공격, 회피 직후, 피격 직후 캡처 → `evidence/g1/` 시트 1장(이미지 Read는 시트 1장만).
- 성능: CH1-02 최대 웨이브에서 평균·최저 FPS(그림 있음/없음 비교). 그림 있음이 없음 대비 20% 넘게 떨어지면 원인 보고.
- 경험 검증은 하지 않는다 → 사용자에게 Windows 테스트 패키지(아래)로 요청.

### 3.7 사용자 검수 패키지
- 기존 Windows exe를 그대로 쓰고 새 pck + 실행 cmd만 전달하는 방식(기획 세션 시험과 동일): `godot --headless --path . --export-pack "Windows Desktop" <out>.pck` → `run_g1.cmd`: `Seonggeom_Demo.exe --main-pack g1.pck -- --fixture=g1_review --seed=1001 --art-candidates`. 격리 QA 저장 사용 확인.
- 파일명은 ASCII만(zip 한글 깨짐 방지). README_KO.txt는 UTF-8 BOM.
- 정식 exe 재빌드(내보내기 템플릿 필요)는 사용자가 요청할 때만.

## 4. 순서와 커밋
1. 0절 규칙·CLAUDE.md·기준 SHA → 커밋 `G1-0`
2. 3.2 로더 + 테스트 → `G1-1`
3. 3.3 상태 판정 + 테스트 → `G1-2`
4. 3.1 ActorView + com_001 연결 + 도형 대체 → `G1-3`
5. 3.4 위치·겹침·그림자 + 3.3b 걷기 속도 맞춤 → `G1-4`
5-1. 3.8 타격 연출 → `G1-4b`
6. 지금 있는 세라 후보(아래 4.1)로 3.6 검증 → `G1-5`
7. 3.5 데이터·문서 → `G1-6`
8. 3.7 패키지 → 사용자 Gate C 요청 → Draft PR

### 4.1 첫 에셋
- 기획 세션이 만든 세라 후보 시트(idle 4·walk 6, down/up/right 3행, 640×240)를 `art/candidates/hero_sera/`에 넣고 새 매니페스트 형식으로 변환(동작 2개만). 정면·뒷면 walk는 임시(서 있는 그림 1px 흔들림) — 매니페스트 `qa.warnings`에 명시.
- 적·보스 에셋이 아직 없으므로 적은 도형 대체 상태로 검증(대체 경로 검증을 겸함).
- 나머지 동작·적·보스는 pixel-forge P9(GPT 연결)로 생산해 같은 폴더 규칙으로 들어온다.

## 5. 하지 말 것
- 전투·미션·저장·성장 코드와 수치 변경, schema 변경.
- 조작 계약(WASD·Space·F·Esc·1~3·E) 외 키 추가.
- 640×360 뷰포트 전환, 월드 좌표 변경.
- 원작(창세기전) 추출물·SF-005 연구 산출물을 에셋 폴더에 섞기.
- 정식 경로(`art/actors/`) 승격, 병합 — 사용자 승인 전.
- 같은 문제 2회 실패 시 계속 시도 — 멈추고 원인 가설 3줄 보고.

## 6. 보고 (10줄 이내)
완료 항목 / 검증 결과(명령·결과 줄, FPS) / 캡처 시트 경로 / 사용자 검수 패키지 경로 / 막힌 점.
