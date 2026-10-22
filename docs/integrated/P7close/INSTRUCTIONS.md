# 지시문 — P7 마감 + 보정 세트 v2 (사용자 승인 2026-10-22)

이 zip을 docs/integrated/P7close/에 풀어라. calibration-v2/의 PNG 5장은 커밋한다(사용자 소유 이미지·저장소 생성물, 상용 스프라이트 아님).

## 0. 무엇이 바뀌었나
- art-judge 보정 확인 2회 무효는 판정자 잘못이 아니라 **기준 세트 설계 오류**였다(기획 세션 확인). 프리렌더 2장(회색 단색·얼굴 가림)은 1배 게임 화면에서 손 도트보다 실제로 약하다. 판정자의 두 순서(C<D<A−≈B, C<A−<D<B)에서 공통인 "현재 프리렌더 최하, 손 도트 치비 최상"이 맞는 관찰이다.
- 사용자 결정: 첫 적용 게임 「성검의 맹세」 아트 = SD 도트, 주력 경로 = GPT 생성 → `forge import`(P8). 3D 프리렌더는 보조 트랙으로 내린다.

## 1. 보정 세트 v2 (art-judge 기준 교체)
- 판정 축(art-judge 문서 맨 위에 명시): **"1배 게임 화면에서의 SD 스프라이트 완성도"** — 실루엣 판독, 얼굴·표정, 역할색, 외곽선·명암의 깔끔함, 디테일 밀도. 렌더 방식(도형·프리렌더·손 도트·AI)은 평가하지 않는다.
- 기준 4장(docs/integrated/P7close/calibration-v2/): `D_prerender-current-knight` < `C_shapes-knight` < `B_handpixel-chibi` < `A_gpt-import-sera`. 시트: calibration-v2-sheet_4x.png.
- 등급 표기: `<D`, `D–C`, `C–B`, `B–A`, `=A`, `>A`.
- 무효 규칙 유지(판정자 순서 ≠ D<C<B<A면 무효). 단 **같은 세트로 무효 2회면 재시도하지 말고** 판정자의 순서와 이유 3줄을 그대로 보고한다(기준 세트 문제로 간주).
- 기존 calibration/(v1)은 삭제하지 말고 README 한 줄로 "v1, 2026-10-22 폐기 — 축 미정의"를 남긴다.
- pixel-reviewer는 폐기, art-judge로 일원화(CLAUDE.md §5 서브에이전트 목록 갱신).

## 2. P7 마감 범위
- 완료 처리: 0(결정), 1(구현 — 기술 수락만: 테스트·QA 통과). 1의 품질 수락 "A− 이상"은 v2 기준으로 바뀌므로 기사 프리렌더를 v2로 한 번 판정해 **등급만 기록**(합격 요구 없음).
- 이번에 할 것: 4번 중 보정 세트 v2 + art-judge 갱신만. asset-scout·prerender-worker·pixel-designer·/batch-prerender·/best-of는 만들지 않는다.
- backlog로 이동(한 줄씩, "prerender 트랙 — 3D 모델 쓰는 프로젝트에서 재개"): 2 해골 가독성, 3 장면 업그레이드, 5 anim.temporal-noise, 6 KayKit 생산, 나머지 서브에이전트·스킬.
- CLAUDE.md §5 모드 줄 교체: `모드: 생물 기본 모드는 프로젝트 바이블의 defaultCreatureMode로 정한다 — import(외부 AI 도트, P8) · prerender(3D 모델) · atoms/frames(아이콘·얼굴 템플릿·이펙트·리그 없는 생물) · shapes(시안용)`. 바이블 스키마에 `defaultCreatureMode`(기본값 "atoms") 추가, sample-v0는 변경 없음. 실제 값 설정은 P8의 seonggeom 바이블에서 "import".
- 그 뒤 /phase-done(시각 검수 단계는 art-judge v2) → progress 현재 단계 P8.

## 3. P8 지시문 보정 (docs/integrated/P8/INSTRUCTIONS.md에 그대로 적용)
- 6번 수락의 "art-judge 등급 B 이상" → "samples/sera_gpt_raw.png(첫 GPT 시트) import 결과가 v2 기준 `B–A` 이상". walk 원본(sera_walk_gpt_raw.png)은 A 기준 이미지의 출처라 판정에 쓰지 않는다(순환 판정 금지). 대신 import 결과의 첫 프레임이 calibration-v2/A_gpt-import-sera.png와 픽셀 차이 ≤ 5%인지 재현성 검사로만 쓴다.
- 1번 "P7이 진행 중이면 P7부터 끝내라" → 이 문서로 P7이 마감되므로 그대로 P8 진행.

## 수락
- `pnpm build && pnpm test` 통과(test-runner) + 결과 줄 첨부.
- art-judge v2 보정 확인 1회 유효(D<C<B<A) + 기사 프리렌더 등급 1줄.
- CLAUDE.md §5, art-judge.md, bible 스키마, backlog, progress 갱신이 한 커밋 또는 번호별 커밋.

## 하지 말 것
- 바이블 sample-v0 값 변경, rules 수치 변경.
- v1 보정 이미지 삭제.
- 무효가 나왔을 때 기준 순서에 맞추도록 판정자 프롬프트를 고쳐 재시도(유도 판정 금지).
