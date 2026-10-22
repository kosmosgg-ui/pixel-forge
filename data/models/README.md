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
   값: 바이블 재질 | `"@eye"`(검은 눈) | `"@eye:<재질>:<단계>"`(색 눈) | `"@outline"`(틈·구멍) | `"@palette"`(아래 표로).
   **팔레트형 텍스처**(KayKit처럼 재질 하나 + 색 칸 텍스처)는 `palette`에 견본 색 표를 적는다 — 알베도와 가장 가까운(OKLab) 견본의 대상으로:
   ```json
   { "map": { "knight_texture": "@palette" },
     "palette": { "knight_texture": [ { "hex": "#929ea4", "to": "metal" }, { "hex": "#f6c29e", "to": "skin" }, { "hex": "#13191b", "to": "@eye" } ] } }
   ```
   견본 색 고르기: 1프레임 프로브 렌더의 알베도 색 무리(오브젝트별)를 보고 무리마다 대표색 1~5개. 눈은 `@eye`로 표시해야 방향 고르기(눈이 보이는 방향)·form.face-visible이 동작한다.
   텍스처가 사실적인 모델(사진 질감)은 재질 하나에 여러 색이 섞여 양자화가 뭉개진다 — 애니풍(단색·팔레트 텍스처) 모델을 권장.
5. Spec(`data/specs/<project>/<id>.spec.json`)에 `"mode": "prerender"`, `"model": "data/models/<id>/<파일>"`,
   `"actions": { "idle": "<Action 이름>", ... }`, 소품을 고를 때 `"hide": [오브젝트 이름…]`을 적는다(형식은 ARCHITECTURE §7.3.2, 예: `data/specs/prerender/kaykit-knight.spec.json`).
6. `pnpm -s forge build <spec>` → QA 실패가 anim.pose-distinct면 `frames`의 연속 키가 너무 비슷한 것 — 움직임이 큰 프레임으로 다시 고른다.

## 애니풍 모델 테스트(다음 단계)
- 사용자가 준비한 모델을 위 1~5대로 넣고 `data/specs/prerender/<id>.spec.json`을 기사 Spec을 복사해 고친다(actions의 액션 이름은 `docs/prerender-poc/probe_model.py`로 확인).
- 결과: `out/<id>/studio.png`(`forge render <spec> --sheet 4`), `forge review prerender`, 목업은 `data/scenes/*.scene.json` + `forge scene`.

## 준비
- Blender 파이썬: Python 3.13 venv에 `pip install bpy==5.2.2` → `.venv-bpy/`(gitignore).
- 스크립트 이름을 표준 모듈과 같게 짓지 않는다(예: `inspect.py`는 bpy 로딩을 깨뜨린다).

## 들어 있는 것
| id | 파일 | 라이선스 | 용도 |
| --- | --- | --- | --- |
| robot | RobotExpressive.glb (three.js 예제) | CC0-1.0 | 초기 확인용(단색 재질) |
| kaykit-knight | Knight.glb (KayKit Adventurers 1.0) | CC0-1.0 | 첫 검증(팔레트 텍스처) |
| kaykit-skeleton-minion | Skeleton_Minion.glb (KayKit Skeletons 1.0) | CC0-1.0 | 첫 검증 |
