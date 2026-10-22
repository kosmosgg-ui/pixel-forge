# data/models — 프리렌더(P7-alt)용 3D 모델

모델 파일(.glb·.gltf·.fbx·.blend·텍스처)은 **저장소에 넣지 않는다**(.gitignore). 저장소에는 아래 두 JSON만 커밋한다.

## 넣는 방법
1. 폴더 `data/models/<id>/`를 만든다(`<id>`는 소문자·숫자·`-`·`_`).
2. 모델 파일을 그 폴더에 둔다. glTF(.glb) 권장 — 애니메이션(Action)이 한 파일에 들어 있어야 한다.
   Mixamo FBX는 캐릭터 1개 + 애니마다 FBX("Without Skin")로 받아 같은 폴더에 둔다.
3. `source.json`(필수) — 출처·라이선스 기록. 없으면 렌더하지 않는다.
   ```json
   { "file": "Model.glb", "sha256": "<sha256sum 결과>", "url": "<받은 곳>", "author": "<제작자>",
     "license": "<예: CC0-1.0>", "retrieved": "YYYY-MM-DD" }
   ```
   상용 게임 에셋·라이선스 불명 모델은 넣지 않는다.
4. `materials.json`(필수) — 모델 재질 이름 → 바이블 재질. 모델 재질 이름은 Blender에서 확인:
   `.venv-bpy/bin/python <스크립트> <모델>`로 `bpy.data.materials` 이름을 출력(예: 로봇 = Main, Grey, Black).
   ```json
   { "bible": "sample-v0", "map": { "Main": "cloth_red", "Grey": "metal", "Black": "leather" } }
   ```
   텍스처가 사실적인 모델(사진 질감)은 재질 하나에 여러 색이 섞여 양자화가 뭉개진다 — 애니풍(단색 재질 위주) 모델을 권장.
5. Spec(`data/specs/<project>/<id>.spec.json`)에 `"mode": "prerender"`, `"model": "data/models/<id>/<파일>"`,
   `"actions": { "idle": "<Action 이름>", ... }`을 적는다(형식은 ARCHITECTURE의 프리렌더 절).

## 준비
- Blender 파이썬: Python 3.13 venv에 `pip install bpy==5.2.2` → `.venv-bpy/`(gitignore).
- 스크립트 이름을 표준 모듈과 같게 짓지 않는다(예: `inspect.py`는 bpy 로딩을 깨뜨린다).

## 들어 있는 것
| id | 파일 | 라이선스 | 용도 |
| --- | --- | --- | --- |
| robot | RobotExpressive.glb (three.js 예제) | CC0-1.0 | 첫 검증(단색 재질) |
