# 통합 지시문 — P7 "프리렌더 본작업 채택" (사용자 승인 완료)

이 zip을 docs/integrated/에 풀어라. 아래 순서대로 진행하고, 각 번호가 끝날 때마다 커밋한다.
참고 자료: calibration/(품질 기준), prerender-poc/(기획 세션 POC 스크립트·결과), scene-ref/(목표 게임 화면).

## 0. 결정 사항
- 3D 프리렌더를 본 제작 방식으로 채택한다. 생물(캐릭터·적)의 기본 모드 = prerender(모델이 있을 때), atoms·frames는 아이콘·얼굴 템플릿·이펙트·리그 없는 생물용, shapes는 시안용.
  → CLAUDE.md §5와 ARCHITECTURE §1의 모드 표, /forge 스킬 문서를 갱신.
- 방향 기본값: 뱀서류 기준 ["se"] 1방향 + 좌우 반전(엔진 flipX). 4방향은 Spec에서 선택(옥토패스형 게임용).
- 해골 미니언의 옆모습 눈 미노출 3방향 결과는 그대로 허용.

## 1. 렌더 품질 회귀 수정 (최우선)
calibration/regression_tool-vs-poc.png: 왼쪽(현재 툴)이 오른쪽(POC)보다 나쁘다 — 갑옷이 흰색으로 날리고, 외곽선이 없고, 검이 몸에 가려진다.
- 명암: POC와 같은 3단계 툰. N·L > 0.45 → 밝음, > −0.1 → 중간, 그 외 → 어둠. "밝음 = 가운데+1" 보정 규칙은 삭제.
- 재질 매핑은 명도 순서를 보존: 같은 바이블 재질로 묶이는 원본 색들은 원본 명도 순위대로 램프 단계에 배치(밝은 회색 = 램프 상단, 어두운 회색 = 하단). 툰 단계는 그 위에서 ±1.
- 외곽선: 바이블 크기 등급의 outline 설정을 프리렌더에도 그대로 적용(현재 누락).
- 카메라: 직교, 고도 30°, 모델 정면 기준 yaw −35°를 "se"로 정의(POC와 동일). 
- 손에 든 무기 가시성: 소품 오브젝트를 ID 패스로 렌더해 방향마다 무기 픽셀 수를 측정, rest 대비 60% 미만 방향은 경고(form.held-visible를 prerender로 확장).
- 크기 일관성: 바이블에 pixelsPerUnit(월드 1단위당 px)을 두고 모든 프리렌더 모델에 같은 값 적용 → 모델 간 실제 키 차이 보존. 기준은 KayKit 기사 키 45px.
- 수락: 기사 idle se가 calibration/A-_poc-prerender-knight.png와 나란히 놓았을 때 같은 수준 이상(art-judge 판정, 아래 4번).

## 2. 해골 가독성
- 모델 교체 검토: Skeleton_Minion 외에 Skeleton_Warrior·Skeleton_Rogue(무기·방어구 포함)를 같은 팩에서 사용.
- 텍스처의 가장 어두운 색 영역(눈구멍·갈비 틈)은 바이블 외곽선색으로 매핑(materials.json에 "→ @outline" 허용).
- 뼈 재질은 따뜻한 미색(bone) 유지, 차가운 흰색 금지.

## 3. 장면(forge scene) 업그레이드
scene-ref/target-scene.py의 구성을 forge scene에 이식: 바닥 타일(16px, 변형·금·이끼), 비네트, 발밑 그림자, 적의 방향 반전(주인공을 바라보게), 피격 흰 플래시 1~2마리, 피해 숫자(3×5 폰트), 경험치 보석, HP바·경험치 바.
- 수락: out/scenes/<이름>.png를 scene-ref/target-scene-prerender_4x.png와 나란히 비교한 시트 생성.

## 4. 품질 판정 체계 (보정 세트 + 서브에이전트)
- calibration/의 등급: D(도형판) < C(현재 프리렌더) < B(손 도트 치비) < A−(POC 프리렌더). 이 4장이 모든 시각 판정의 기준이다.
- 판정은 점수 대신 "어느 둘 사이인가" 등급 + 관찰 3줄. 판정자가 기준 4장의 순서를 스스로 다시 매겨 D<C<B<A−가 아니면 그 판정은 무효.
- 새 서브에이전트(.claude/agents/):
  - art-judge (inherit; Read, Glob, Bash(forge compare)): 위 규칙으로 등급 판정. 파일 수정 금지. pixel-reviewer는 이것으로 대체.
  - prerender-worker (haiku; Bash, Read): Spec 하나 → forge build → 한 줄 JSON만 반환. 바이블·rules·공용 파일 수정 금지.
  - asset-scout (sonnet; WebSearch, WebFetch, Bash(git clone), Read): 3D/2D 에셋 팩 조사. 라이선스 원문 인용 필수, docs/assets/<팩>.md 20줄 이내.
  - pixel-designer (inherit; Read, Write — data/specs·docs/briefs 아래만): 아이콘·얼굴 템플릿·이펙트 그리드 후보 1개 설계.
- 새 스킬: /batch-prerender <project>(prerender-worker 최대 4개 병렬 → 실패만 모아 보고 → review·scene 1장), /best-of <brief> --n 4(pixel-designer 병렬 → compare 시트 → art-judge 선택; 아이콘·얼굴·이펙트 전용).
- 비용 규칙: 병렬 최대 4, 이미지 Read는 art-judge만, 시트 1장 원칙, 에이전트 반환은 10줄 이내.

## 5. 시간 안정성 지표
스키닝 메시는 기존 깜빡임 검사가 무의미하다. 대체 지표 anim.temporal-noise: 연속 프레임에서 객체 ID와 양자화 노멀이 같은 픽셀 중 색이 바뀐 비율. idle·walk에서 ≤ 3% 목표, 초과 시 직전 프레임 색 유지(안정화) 옵션.

## 6. 생산 (1~5 완료 후)
- 주인공: KayKit Adventurers의 Knight·Rogue_Hooded·Mage·Barbarian.
- 적: KayKit Skeletons의 Minion·Warrior·Rogue·Mage + 색 변형 3단계(일반·강화·정예) → 12종.
- /batch-prerender로 생산, 장면 1장에 주인공 1 + 적 12종 배치.
- 수락: 전원 QA 필수 통과, art-judge 등급 A− 이상, 장면 비교 시트. 보고 문서에 장면·비교 시트 경로.

## 순서
1 → 2 → 3 → 4 → 5 → (/phase-done) → 6. 같은 문제로 2회 실패하면 멈추고 보고.
