# 지시문 — P8 "AI 생성 도트 가져오기(import) + seonggeom 연동" (사용자 승인 완료)

CODEX_HANDOFF_seonggeom.md는 게임 저장소(Codex)용이다. 클로드 코드는 읽기만 하고 게임 저장소를 수정하지 않는다(candidates 폴더 쓰기 제외).

(P7close로 P7 마감 — 그대로 P8 진행.) 이 작업은 P7과 파일이 겹치지 않는다(packages/import 신규).
참고: samples/sera_gpt_raw.png(사용자가 GPT로 만든 원본, 640×240, 3줄×10칸), samples/sera_clean_preview_2x.png(기획 세션 시제품 결과).
원본 이미지는 저장소에 커밋하지 않는다(data/import/ 는 .gitignore). 테스트는 코드로 만든 합성 이미지로 한다.

## 0. 배경 (왜 필요한가)
GPT 등 이미지 AI가 만든 "도트풍" 시트는 그림 수준은 높지만 에셋으로 바로 쓸 수 없다. 기획 세션 측정 결과:
- 진짜 도트가 아님: 한 칸에 2,000색 이상, 테두리 알파가 95~253 사이 반투명.
- 격자를 지키지 않음: 30개 중 17개 스프라이트가 64px 칸 경계를 넘음, 3개는 이미지 가장자리에서 잘림.
- 중복 프레임: 한 줄 10칸 중 서로 다른 그림은 7개.
- 발 위치·중심이 프레임마다 다름.
시제품(연결 성분 분리 → 공유 32색 → 알파 이진화 → 발 기준 정렬)만으로도 원본 느낌을 유지한 채 정리됨을 확인했다.

## 1. 모드 정의
- 새 모드 `import`: 외부 이미지(시트 또는 낱장) → pixel-forge 표준 산출물(IndexedRaster 프레임, 시트 PNG, Aseprite JSON, manifest).
- 이후 단계(외곽선·QA·export)는 기존 모드와 같은 경로를 탄다. 렌더러 대신 "추출기"가 프레임을 공급하는 구조.
- 결정론: 같은 입력 파일 + 같은 Spec → 바이트 동일 출력. 입력 파일 sha256을 manifest에 기록.

## 2. Spec (zod)
```jsonc
{
  "mode": "import",
  "source": { "path": "data/import/sera_gpt_raw.png", "origin": "gpt-image", "createdAt": "2026-10-22" },
  "layout": { "rows": [ {"anim":"idle","dir":"s","frames":[0,1,2,3]}, {"anim":"walk","dir":"e","frames":[4,5,6,7,8,9]} ] },
  "cell": { "w": 64, "h": 84, "anchor": "feet-center" },
  "palette": { "from": "bible" | "auto", "max": 32 },
  "alphaThreshold": 128,
  "dedupe": true
}
```
- `layout.rows[i].frames`는 해당 줄에서 왼쪽부터 찾은 스프라이트 순번. 생략 시 줄 전체.
- `source.origin`은 필수(스팀 AI 공개 기록용). manifest의 `aiGenerated: true`로 이어진다.

## 3. 처리 단계 (packages/import, 각 함수 ≤60줄, 순수 함수)
1. **알파 이진화**: alpha ≥ threshold → 불투명, 아니면 투명. 배경이 불투명(흰색·단색)인 입력은 모서리 4점 최빈색을 배경으로 보고 허용오차 내 색을 투명 처리.
1-1. **해상도 맞춤(targetHeight)**: GPT 출력은 픽셀 격자가 일정하지 않은 "도트풍 고해상도"(캐릭터 키 550~1,640px, 격자 추정 불가 확인)다. 스프라이트 분리 후, 같은 Spec의 모든 프레임에 **하나의 공통 배율**(가장 큰 프레임 키 → targetHeight)을 적용해 줄인다. 프레임마다 따로 맞추면 걷기 중 키가 출렁인다. 방식: 알파 사전곱(premultiplied) 후 BOX 축소 → 언프리멀티플라이 → 알파 이진화. 최근접 축소 금지(가는 선이 끊김). Spec: `"targetHeight": 72` (생략 시 원본 크기 유지 — 이미 게임 크기인 입력용).
2. **스프라이트 분리**: 격자를 믿지 않는다. 불투명 마스크를 2px 팽창 후 8-연결 성분 분리, 높이 < 셀 높이의 40%인 조각은 가장 가까운 큰 성분에 병합(검 끝·머리카락 끝이 떨어진 경우). 줄 구분은 성분 세로 중심의 k-means(k = layout.rows 수).
3. **잘림 검사**: 성분이 이미지 가장자리에 닿으면 `import.clipped` 경고 + 해당 프레임 번호 보고.
4. **중복 제거**: 같은 줄에서 픽셀 완전 동일 프레임은 하나로(원래 순서는 manifest의 frameMap에 기록). dedupe:false면 유지.
5. **팔레트**: 모든 프레임을 합쳐 OKLab에서 median-cut → max색. `from: bible`이면 바이블 램프에 최근접 매핑(명도 순서 보존 — P7 1번 규칙과 같은 함수 재사용). 디더링 금지.
6. **정렬**: 기본 앵커 = 마스크 최하단 행의 불투명 픽셀 x 중앙(발) + 최하단 y. 머리카락·망토가 흔들려도 몸이 떨리지 않게 bbox 중심을 쓰지 않는다.
7. **외곽선 정리**: 바이블 outline 설정 적용. 이미 어두운 테두리가 있으면(외곽 픽셀의 70% 이상이 램프 최하단 2단계) 추가하지 않는다.
8. **셀 맞춤**: cell보다 큰 스프라이트는 축소하지 않고 `import.oversize` 오류. 크기는 사용자가 정한다.

## 4. QA 추가 항목
- `import.palette-delta`: 양자화 전후 평균 OKLab ΔE. > 0.06이면 경고(색 뭉개짐).
- `import.jitter`: idle 연속 프레임 사이 앵커 이동 > 1px이면 경고.
- `import.identity`: 같은 캐릭터의 프레임들 사이 팔레트 히스토그램 거리 — 한 프레임만 튀면 "다른 캐릭터처럼 생성된 프레임" 경고(AI 생성 드리프트 검출).
- 기존 anim.temporal-noise(P7 5번)는 import에도 적용.

## 5. CLI
- `forge import <spec>` → out/<이름>/ 에 표준 산출물.
- `forge import --probe <png>`: Spec 없이 분석만. 스프라이트 수, 줄 수, 크기 분포, 잘림, 중복, 색 수를 표 한 장으로 출력(Spec 작성 보조).

## 6. 수락
- 합성 테스트: 격자 어긋남, 반투명 테두리, 가장자리 잘림, 중복 프레임, 흰 배경 각각 1케이스.
- 사용자 원본으로 `--probe` → 결과가 "스프라이트 30, 줄 3, 잘림 3, 고유 프레임 21"과 일치.
- (P7close 3번 보정) samples/sera_gpt_raw.png(첫 GPT 시트) import 결과가 보정 세트 v2 기준 `B–A` 이상(art-judge). walk 원본(sera_walk_gpt_raw.png)은 A 기준 이미지의 출처라 판정에 쓰지 않는다(순환 판정 금지) — 대신 import 결과 첫 프레임이 calibration-v2/A_gpt-import-sera.png와 픽셀 차이 ≤ 5%인지 재현성 검사로만 쓴다.
- 보고 문서에 비교 시트 경로와 경고 목록.

## 7. 첫 적용 게임: 「성검의 맹세」(seonggeom) — 사용자 결정 (2026-10-22)
범용 툴 원칙 유지: 게임 이름·수치는 코드에 넣지 않고 `data/projects/seonggeom/` 바이블·타깃 설정으로만 둔다.
- 아트 방향: **SD(2.5등신 치비) 도트**. GPT 생성 → `forge import`가 주력 경로.
- 화면: 게임 기준 해상도 640×360, 엔진에서 정수 2배(1280×720)·3배(1920×1080) 확대. 에셋은 **1배 논리 크기**로만 만든다(미리 확대 금지).
- 크기(바이블 기본값, 사용자 Gate C에서 조정 가능): 주인공 키 60px(셀 64×80, 발 앵커 (32,78) — 게임 기존 계약 유지), 일반 적 키 46px(셀 48×56), 보스 키 88px(셀 112×112). 기존 데이터의 표시 키 비율(72:60:110)을 유지한 값.
- 방향: 주인공·보스 4방향(front, back, side + 좌우 반전), 일반 적 side 1방향 + 반전.
- 출처 기록: manifest의 출처 필드를 게임의 provenanceFields 이름과 맞춘다 — `assetId, creator, sourceUrl, license, aiUsed, promptRecord, editedBy, sourceFile, exportFile, rightsReviewed, creditText`. import 모드는 `aiUsed: true`, `rightsReviewed: false`(사람만 true로 바꾼다).

## 8. export 타깃: seonggeom 매니페스트
samples/seonggeom_sera_manifest.json이 게임이 읽는 형식이다. 새 export 어댑터 `godot-rowsheet`(범용 이름)를 만든다.
- 출력: `<asset>_sheet.png`(행 = 방향, 열 = 애니메이션 프레임 연속) + `<asset>_manifest.json`.
- manifest 키: `version, quality, source, frame_size, sheet_size, columns, rows, directions{down,up,right,left:{row,flip_h}}, animations{<name>:{start_column,frames,fps}}, anchor` + `provenance{…7번 필드}` + `qa{…경고 목록}`.
- `quality`는 항상 `"candidate"`로 시작. 게임 쪽 Gate C 통과 전 다른 값 금지.
- 출력 위치: `.forge/targets.local.json`의 `@seonggeom` → 게임 저장소의 `art/candidates/<assetId>/`(본 에셋 폴더 덮어쓰기 금지 — 게임 규칙 "승인 후에만 asset binding 변경").
- 수락: 생성된 manifest를 samples/seonggeom_sera_manifest.json과 키 단위 비교하는 테스트(값이 아니라 구조).

## 9. 첫 생산 시험 (1~8 완료 후)
세라 1명: idle 4, walk 6, attack 5, hurt 3 × 4방향. GPT 원본은 사용자가 제공한다(samples/sera_walk_gpt_raw.png가 walk-side 원본).
- 산출: 시트·manifest + 640×360 장면에 1배로 놓고 2배 확대한 미리보기(samples/sd56_gameview_720p.png와 같은 방식) 1장.
- 사용자에게 Gate C 판단용으로 보고. 게임 저장소에는 candidates 폴더에만 쓴다.

## 하지 말 것
- AI 이미지 생성 API 호출을 이 모드에 넣지 않는다(입력 파일만 받는다). 생성은 사용자가 하거나 별도 provider 단계에서.
- 격자 크기 추정에 의존하지 않는다(GPT는 격자를 지키지 않는다).
- 원본·결과 PNG를 커밋하지 않는다.
