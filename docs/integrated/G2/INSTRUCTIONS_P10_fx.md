# 지시문 P10 — 크기 변경 반영 + 전투 이펙트 직접 생성 (사용자 승인 2026-10-22 23:47)

대상 저장소: kosmosgg-ui/pixel-forge. 선행: P8 완료, P9-M과 병행 가능.
근거 문서: 「성검의 맹세 화면·타격감·연출 검토」(사용자 결정 반영본).

## 0. 크기 변경 (사용자 결정: 적 무리 가독성 때문에 축소)
- data/projects/seonggeom/seonggeom.bible.json sizeClasses:
  - hero: 셀 48×64, 발 앵커 (24,62), targetHeight 48
  - enemy: 셀 48×48, 발 (24,46), targetHeight 36~40(종류별 Spec에서 지정)
  - boss: 셀 96×96, 발 (48,94), targetHeight 72~80
- 바이블 변경이지만 사용자 승인 사항. 이전 값은 `$history`에 남긴다.
- 기준 이미지 A(art-judge v2)는 64px 그대로 둔다(판정 기준은 크기와 무관한 완성도). 대신 48px 변환본을 `calibration-v2/A48_gpt-import-sera.png`로 추가하고 art-judge 문서에 "48px 대상은 A48과 나란히 본다" 한 줄.
- 첫 입력은 사용자가 새로 만든 GPT 원본(zip의 inputs/hero_sera/): `hero_sera__walk_side.png`(채택, 머리 흔들림 3px)를 intake → 48px make → seonggeom candidates(G1 첫 후보). `__alt`는 비교용(흔들림 5px, 채택 안 함). 파일럿은 더 이상 쓰지 않는다. 매니페스트 walk `stride_px`는 변환 결과에서 실측(접지 프레임 앞뒤 발 간격 평균).

## 1. 가독성 보강 (외부 검토 의견 중 타당한 것 반영)
- **외곽선 복원**: P8 재현성 검사는 "외곽선 없음"으로 통과했다. 실제 게임 출력에는 바이블 외곽선(1px, 어두운 선택 외곽선 — 바깥 경계 중 배경과 맞닿는 픽셀을 램프 최하단으로)을 적용한다. 48px에서 실루엣 분리가 핵심이기 때문. 재현성 검사는 지금처럼 외곽선 없이 유지(검사 목적이 다름).
- **명암 단순화 실험**: colorBudget 32와 24 두 가지로 세라 walk를 변환해 art-judge에 비교 판정. 갑옷·치마 중간톤 얼룩(P8 판정자 관찰)이 줄어드는 쪽을 제안(바이블 값 변경은 사용자 승인 후).
- **QA 추가**
  - `anim.head-bob`: 걷기에서 머리 꼭대기 y 변화(1배). 48px 기준 3px 이하 정상, 4px 이상 경고(기획 세션 실측: 채택본 3px, 비교본 5px)
  - `anim.foot-contact`: 접지 프레임(1·4)에서 앞발 최하단이 발 앵커 행에 닿는지
  - `form.weapon-separation`: 무기(검) 색 픽셀 중 몸통 실루엣에 둘러싸인 비율 > 60%면 경고(검이 몸에 묻힘). 무기 색은 바이블 재질(metal_blade)로 판별
  - `view.top-visibility`(정보만): 머리 윗면 픽셀 행 수 — 3/4 시점 프롬프트 효과 측정용

## 2. 이펙트 — 외부 도구 pxl로 제작 (사용자 결정 2026-10-23 00:22, P6.5 모드 재사용안 대체)
기획 세션이 claude-pxl을 검토·시험했다(samples/pxl_trial/: sg_fx.px.js 소스, 결과, 게임 화면 모형). 이펙트는 pxl이 그리고 pixel-forge는 **게임 형식 포장 + QA**만 맡는다.

### 2.1 도구 설치 (저장소 의존성 아님 — 선택 외부 도구, Aseprite와 같은 규칙)
- 출처: https://github.com/augusto-scarvalho/claude-pxl (MIT, 런타임 의존성 없음, Node ≥ 22.18). **커밋 2e72b9a에 고정**(일주일에 300커밋 넘게 바뀌는 신생 포크라 최신을 따라가지 않는다).
- 설치: `git clone https://github.com/augusto-scarvalho/claude-pxl.git ~/.claude/skills/pxl-pixel-art && git -C ~/.claude/skills/pxl-pixel-art checkout 2e72b9a`. 클라우드 세션이면 매 세션 같은 명령(가능하면 환경 설정 스크립트에). 저장소 안에 복사·서브모듈 금지.
- 경로는 환경변수 `PXL_BIN`(기본 `~/.claude/skills/pxl-pixel-art/bin/pxl.js`). 없으면 `ForgeError("fx.pxl-missing")` + 설치 명령 한 줄. `node --version` 22.18 미만이면 같은 방식으로 보고.
- `/tool-scan` 표에 pxl 행 추가(사용 가능/없음, 커밋).
- pxl 자체의 SKILL.md는 이펙트 작업 때만 읽는다(필요한 절만 `pxl help "<절>"`로 — 토큰 절약 규칙 그대로).

### 2.2 이펙트 소스와 빌드
- 소스: `data/projects/seonggeom/fx/sg_fx.px.js` 하나(시험작에서 시작해 확장). 팔레트는 바이블 `fxPalette` 제안값과 같은 키로: 흰 w·v, 청록 c·C·n, 금 y·j·J, 먼지 g·G, 보석 m·M, 외곽 k. 적 예고색(빨강·주황) 사용 금지.
- 대상 12종(크기·프레임은 이전 표 유지): fx_slash_1·2·3, fx_hit_spark, fx_dust, fx_death_puff, fx_xp_gem, fx_ring_0~8, fx_shockwave, fx_proj_seeker, fx_orbit_sword, fx_beam.
- 8방향이 필요한 것(검기·투사체·회전검·빛줄): pxl의 회전 기능(`rot`/`rotate`, rotation.md의 권장 방식)으로 **빌드 시 미리 생성**. 실시간 회전 금지.
- 타이밍은 pxl 안내서 "scenes 12. One-shot effects" 규칙(스미어 2프레임 + 끝 조각 1, 타격 = 어두운 점 → 흰 별 → 흰 원 → 청록·노랑 초승달)을 따른다. 게임 쪽 연출 수치(G1 3.8·3.9)와 맞출 것: 1·2타 검기는 예비 0.12초 안에 열림, 3타는 0.16초.
- 검기 위치·반지름은 실제 판정과 맞춘다: 기본 연계 range 90, angle 90(3타 110)을 화면 크기(×2/3)와 1배 픽셀(÷2)로 환산한 반지름 ≈ 30px(1배) — 시험작은 21px라 작다.
- 빌드: `node $PXL_BIN build sg_fx.px.js` → `out/anims/*.png`(가로 스트립) + `*.json`.

### 2.3 pixel-forge 포장 (`forge fx-import`)
- pxl 출력(스트립 PNG + JSON)을 읽어 godot-rowsheet 매니페스트(`kind: "fx"`)로 변환 → `art/candidates/fx_<id>/`. 8방향은 행 8개(`rows: {e,se,s,sw,w,nw,n,ne}`).
- provenance: `creator: "pixel-forge/pxl (code-drawn)"`, `aiUsed: false`, `sourceFile: sg_fx.px.js`, `promptRecord: null`, pxl 커밋 SHA 기록. (코드로 그린 그림 — 생성형 AI 산출물 아님. 단, 소스 코드를 AI가 썼다는 사실은 `editedBy`에 "Claude Code"로 남긴다.)
- QA(기존 fx 규칙): 알파 0/255, 팔레트 일치, 프레임 수, 8방향 완비, 크기.

### 2.4 품질 진단 보조 — `pxl study`
- import 결과(캐릭터 시트)에 `node $PXL_BIN study <sheet.png> --no-out`을 돌려 수치만 뽑아 `qa.study`에 기록: 외톨이 픽셀 비율, 밴딩(1000px당), 붙은 색 단계 수(OKLab 0.05 미만), 튀는 색(eyeburn), 안티앨리어싱 비율.
- 기획 세션 실측(48px 세라 걷기·턴어라운드 시트): 외톨이 24%, 밴딩 44.6/1000px, 붙은 단계 3쌍, 튀는 파랑 1, AA 26%. → 1절의 32색/24색 비교 실험을 이 수치로 판정(외톨이 15% 이하, 밴딩 30 이하 목표 — 제안값, 사용자 승인 전 경고만).
- import 정리 단계 개선(제안 후 구현): 붙은 단계 병합(OKLab 0.05 미만), 외톨이 점을 주변 다수색으로 흡수(외곽선·눈 픽셀 보호). 바뀐 결과를 다시 study로 재서 전후 표를 보고.

## 3. 컷인 (사용자 결정: 필살기 컷인 삽입)
- 컷인은 GPT 일러스트를 **도트 변환하지 않고** 정리만: 배경 제거(초록), 가로 1280 이하로 축소(linear), PNG. `forge intake --kind cutin` 경로 추가, 출처 기록(aiUsed true) 동일.
- 프롬프트 템플릿 `actions/cutin.json`: 상반신, 검을 들어 올린 결의의 표정, 대각선 구도, 강한 명암, 초록 배경.
- 출력: `art/candidates/cutin_hero_sera/cutin.png` + 매니페스트(`kind: "cutin"`).

## 수락
- 바이블 크기 변경 + 파일럿 세라 48px make → candidates 출력(외곽선 적용) + 32색/24색 비교 시트 + art-judge 관찰.
- 새 QA 4종 테스트(합성 입력) 통과.
- pxl 설치 확인(커밋 2e72b9a) + sg_fx.px.js로 fx 12종 빌드 → `forge fx-import` → candidates, 8방향 세트 검사 통과, 게임 2배 미리보기 시트 1장.
- `qa.study` 수치 기록 + 32/24색과 정리 개선 전후 비교 표.
- 컷인 intake 경로 테스트(합성 입력).
- 보고 10줄: 시트 경로, QA 경고, 32 vs 24 판정, 사용자 결정 필요 항목(fxPalette·colorBudget).

## 하지 말 것
- 이펙트를 GPT로 만들기(코드 그림 원칙 — 스팀 AI 공개 범위 최소화).
- pxl을 저장소에 복사·서브모듈·의존성으로 추가, 고정 커밋 외 버전 사용.
- 실시간 회전·소수 배율 전제의 이펙트.
- 사용자 승인 없이 바이블 colorBudget·fxPalette 확정.
