# 3D 프리렌더 → 도트 개념 검증 (기획 세션에서 실행 확인)

## 환경 (중요)
- Blender는 별도 설치 없이 PyPI의 `bpy`로 된다. **bpy 5.x는 Python 3.13 전용**이라 3.12 이하에서는 "배포판 없음"이 뜬다.
  `python3.13 -m venv .venv-bpy && .venv-bpy/bin/pip install bpy==5.2.2`
- 스크립트 파일 이름을 `inspect.py` 등 표준 라이브러리 이름으로 짓지 말 것(bpy가 import하며 이중 초기화로 abort).
- 렌더러: Cycles CPU, 1샘플, 필터 폭 0.01(안티앨리어싱 없음), 투명 배경. 프레임당 수십 ms.

## 파이프라인
1. probe_model.py <glb|fbx>: 액션·메시·재질 목록
2. render_sprites.py -- <model> <outdir> <목표키px> '<{"액션":[프레임...]}>' '<[방향 각도...]>'
   - 2배 해상도로 두 패스 렌더: 알베도(재질을 base color 발광으로 교체) + 노멀(월드 노멀 발광 오버라이드)
3. to_pixel.py <outdir> <pxdir> <K>
   - 알베도 k-means K색 → 색마다 3단계 색상 이동 램프
   - 노멀·광원 내적으로 3단계 툰 셰이딩
   - 2×2 블록 다수결로 1배 축소(잡티 감소) → 고립 픽셀 정리 → 1px 어두운 외곽선

## 결과
- result-robot-flat.png: 단색 재질의 스타일화 모델(three.js 예제 RobotExpressive, CC0) → 동작·입체감·일관성 좋음
- result-soldier-textured.png: 사실적 텍스처 모델(Mixamo 파생 Soldier) → 진흙처럼 뭉개짐
- 결론: 품질은 모델 스타일이 좌우. 단색·툰 재질 + 과장된 비율의 모델이 필요.

## 툴 이식 시 할 일
- k-means 대신 바이블 팔레트로 직접 양자화(재질 이름 → 바이블 재질 매핑 파일)
- 외곽선·정리·깜빡임 검사·시트 출력은 기존 packages 재사용 (IndexedRaster로 진입)
- 카메라 프레이밍을 전 프레임 범위 기준으로(사망 애니에서 잘림)

## 추가 실험: KayKit Adventurers (CC0, 그림 작업 0)
- 출처: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (LICENSE.txt: CC0, 상업 이용 가능, 크레딧 선택)
- 같은 계열: KayKit-Character-Pack-Skeletons-1.0 (해골 미니언·전사·마법사·도적)
- 캐릭터 glb 하나에 무기·방패가 전부 들어 있음 → 환경변수 HIDE로 안 쓰는 소품 숨김
  `HIDE=1H_Sword_Offhand,2H_Sword,Badge_Shield,Rectangle_Shield,Spike_Shield .venv-bpy/bin/python render_sprites.py -- Knight.glb out 44 '{"Idle":[0,12],"Walking_A":[0,4,8,12,16,20],"1H_Melee_Attack_Slice_Diagonal":[0,6,10,13,17,22],"Hit_A":[0,5,10],"Death_A":[0,5,10,15,19]}' '[-35,35,145,-145]'`
- 결과 result-kaykit-knight.png: 치비 기사가 대기·걷기·베기·피격·사망·4방향까지 일관되게 나옴
- 실패: 해골 미니언을 k-means 색으로 돌리면 뼈색이 살색처럼 보이고, 35° 방향은 뒤통수라 눈이 안 보임 → 바이블 팔레트 직접 매핑(materials.json)과 방향별 정면 확인이 필요
- 사망 애니에서 캐릭터가 화면 밖으로 잘림 → 전 프레임 범위로 카메라 프레이밍
