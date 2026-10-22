# Codex 인계 — 「성검의 맹세」 아트 방향·화면 배율 결정 반영 (사용자 승인 2026-10-22)

권위: 최근 명시적 사용자 승인. 기획서 v1.2의 아트 방향(SD보다 사실적인 비례)은 **유지**하고, 제작 방식·화면 배율·크기·방향을 아래처럼 확정한다.
범위: 문서·데이터·프로젝트 설정·검수용 연결만. 정상 미션의 asset binding 교체는 Gate C 후 별도 승인.
작업 규칙은 AGENTS.md 그대로(작업 전 SHA, 격리 브랜치, 허용 파일 제한, 종료 시 해시·명령 기록, Draft PR).

## 1. 결정 기록
`data/15_decision_register.json`에 3건 추가:
- ART-PIPE-GPT: 아트 방향 = 사실 비례(약 6등신) 애니풍 도트(v1.2 유지). 생산 = GPT 애니 일러스트 → pixel-forge(외부 오프라인 툴) import로 도트 변환·정리 → 후보 제출. 기존 "Character Master + 파츠 + native 재작화" 제작 방식은 superseded로 표시(삭제 금지). 원작 픽셀 분석(SF-005)은 팔레트·시점 참고 자료로만 유지.
- DISPLAY-INT-SCALE: 기준 해상도 640×360, 정수 배율 확대. 기존 64×80 → 96×112 비정수 표시 폐기.
- DIR-SPLIT: 주인공·보스 4방향(front/back/side+반전), 일반 적 side+반전. "추후 재검토" 표시.

## 2. 데이터 갱신
`data/12_assets_audio_tools.json`
- `style.genre`: `SD_anime_2D` → `anime_proportional_pixel`(약 6등신). 이전 값은 `style.previousGenre`에 보존. `finalCharacterDesign`은 false 유지.
- `actorPipeline.workingChoice`: Krita 파츠 리깅 → `"gpt_image_plus_pixelforge_import_rowsheet"`. parts 목록은 삭제하지 말고 `deprecated` 키 아래로 이동.
- `assetRows[*].displayHeight` → `logicalHeight`로 이름 변경, 값: 주인공 64, 일반 적 52, 보스 96. `canvas`: 주인공 [64,80], 적 [64,64], 보스 [128,128].
- 주인공·보스 `directions`: `"front_back_side_mirrored"`. 적은 기존 유지.
- 기획서 6.1의 "논리 64×80 / 발 (32,78)"은 유지, "표시 96×112" 문구만 "정수 배율(2×/3×)"로.

## 3. 프로젝트 설정 (project.godot)
- `display/window/size/viewport_width=640`, `viewport_height=360`
- `display/window/size/window_width_override=1280`, `window_height_override=720`
- `display/window/stretch/mode="canvas_items"` — 한글 UI 글자를 고해상도로 유지하기 위해 viewport 모드가 아닌 canvas_items.
- `display/window/stretch/scale_mode="integer"`
- `rendering/textures/canvas_textures/default_texture_filter=0`(Nearest)
- `rendering/2d/snap/snap_2d_transforms_to_pixel=true`
- 영향: 기존 월드 좌표(맵 rect 1280×960 등)와 카메라. 월드 단위를 그대로 두고 Camera2D zoom으로 맞출지, 좌표를 절반으로 줄일지 ARCHITECTURE_AUDIT에서 비교 후 사용자 승인. 이 문서만으로 좌표 데이터를 바꾸지 않는다.
- 수락: 1280×720과 1920×1080 창에서 64×80 테스트 스프라이트의 픽셀 한 칸이 정확히 2×2·3×3인지 캡처로 확인(Gate B).

## 4. 기존 세라 텍스처 결함 (참고, 수정은 새 후보로 대체)
- `sera_back_run`: 실제로는 옆모습 프레임(원본 시트 2행 5~10열이 측면). 위로 이동 시 옆모습이 보임.
- run 6프레임: 다리 교차 없음(매니페스트에도 PLACEHOLDER로 기재).
- front_run 일부 프레임: 원본 시트 가장자리 잘림으로 머리카락 손실.
→ pixel-forge 후보로 교체 예정. 기존 파일은 손대지 않는다.

## 5. 후보 수령 계약
- pixel-forge는 `art/candidates/<assetId>/`에만 쓴다: `<assetId>_sheet.png`, `<assetId>_manifest.json`(기존 sera_manifest.json 구조 + `provenance` + `qa`), 미리보기 PNG.
- `quality: "candidate"`, `provenance.aiUsed: true`, `provenance.rightsReviewed: false`.
- 게임 쪽 Gate B 검사: 시트 크기 = columns×frame_size, 앵커 픽셀이 발 위치, 알파 0/255만, 방향별 행 존재, provenance 11개 필드 존재.
- Gate C(사용자) 통과 후에만 `art/demo_100/...` 등 정상 경로로 binding 변경, `quality`와 `rightsReviewed`는 사용자 확인 후 변경.
- 스팀 출시 시 AI 사용 공개: provenance의 `aiUsed`가 true인 에셋 목록을 Release Gate 체크리스트에 자동 집계.

## 6. 하지 말 것
- 이 인계만으로 정상 미션 아트 교체, 저장 schema 변경, 전투 수치 변경.
- candidates 폴더 파일을 원작 추출물·SF-005 연구 산출물과 섞기.
