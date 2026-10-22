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
