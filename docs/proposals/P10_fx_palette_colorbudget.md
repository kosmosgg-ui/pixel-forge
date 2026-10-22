# 제안서 — P10 사용자 결정 필요 항목 (바이블 값, 승인 전 미적용)

## 1. 바이블 `fxPalette` (P10 2.2)
아군 이펙트 전용 팔레트. 적 예고색(빨강·주황)과 겹치지 않게 흰·청록·금 계열만. 지금은 `data/projects/seonggeom/fx/sg_fx.px.js`의 `pal()`에만 있다.

| 키 | 색 | 쓰임 |
| --- | --- | --- |
| k | #141824 | 외곽 어둠(보석 외곽선·섬광 첫 프레임) |
| w · v | #ffffff · #f4f0dc | 흰·따뜻한 흰(검기 안쪽 날, 섬광) |
| c · C · n | #7ff0e6 · #2fb8b0 · #1d6f78 | 청록 3단(1·2타 검기, 투사체, 빛줄) |
| y · j · J | #ffe27a · #e0a83a · #9a6420 | 금 3단(3타 검기, 고리, 충격파) |
| g · G | #b8b3a8 · #7d786e | 먼지·연기(중립 회색) |
| m · M | #9fe0ff · #3f7fd0 | 경험치 보석(소) |

승인되면 바이블 `fxPalette`에 같은 키로 넣고 `sg_fx.px.js`가 그 값을 읽게 바꾼다.

## 2. 바이블 `colorBudget` 32 → 24 (P10 1절, 근거: pxl study — 결과는 아래 표)
32색/24색 세라 48px 걷기 비교와 정리 개선 전후 수치는 이 문서 아래 「study 비교」 표(커밋 후 갱신).

## 3. 바이블 재질 `metal_blade` (form.weapon-separation)
무기 색 판별 기준. 지금 seonggeom 바이블에는 없어 검사는 값 null로 생략한다. 제안: `metal_blade: { base: "#c8d4dc", steps: 3, kind: "metal" }`(세라 검 은색 실측 근처) — 승인 시 검사 활성.
