# P13 초상 수령

초상은 도트 변환하지 않는 승인 일러스트 예외. 기존 이미지 API 호출 없음. 합성 검사는 입력/좌표/키 제거/프리멀티플라이 linear·클리핑을 확인하며 해부학/최종 미술을 인증하지 않는다.

```sh
# 작업 폴더 안에 받은 원본 PNG를 복사한 뒤 (data/import/inbox는 ignored)
pnpm forge intake data/import/inbox/sera__portrait_set.png --kind portrait --as sera/portrait_set
pnpm forge intake data/import/inbox/leona__portrait_set.png --kind portrait --as leona/portrait_set
pnpm forge intake data/import/inbox/npc__portrait_set.png --kind portrait --as npc/portrait_set
pnpm forge intake data/import/inbox/sera.png --kind portrait --as sera/default
```

기본 출력 `out/art/candidates/portraits/<char>/<expression>.png` + expression_manifest.json, 작업용 사본 `out/portraits/`. 원본은 data/import/<char>/portraits/<set>/해시이름.png·intake.json. 4칸 sera=2×2 TL/TR/BL/BR, leona 2칸=1×2 좌우, npc 2칸=clerk/mia. 단일은 표정 ID 지정. 모든 PNG는 높이720 캔버스/머리꼭대기y40/가로중앙, 확대 없이 linear 축소. 초록 키 배경 제거→가장자리2px despill, 팔레트/도트화하지 않음.

`--out @seonggeom`을 쓰려면 사람이 작성하는 `.forge/targets.local.json`의 허용 대상이 게임 프로젝트 루트를 가리켜야 한다. 목록이 없는 현재 환경에서는 로컬 staging만 생성하고, 검수 후 seonggeom `art/candidates/portraits`로 복사한다. Codex가 허용 목록을 임의 생성하지 않음. 원본 수령 시 `--archive out/seonggeom-art-source/art-source`를 추가하고 **비공개 seonggeom orphan art-source**에서만 commit/push, 병합 금지. pixel-forge 원본 push 금지.

QA: green-key 잔여0, 입력 상단/좌우 bbox 접촉 경고(머리/어깨 잘림 proxy), 4칸 상단1/4 실루엣 폭 편차≤8%. 머리 해부학 폭은 머리카락/포즈에 영향받으므로 실제 원본에서 사람 초상 일관성 판정도 필요. provenance 11필드/aiUsed:true/rightsReviewed:false 유지. 원본 미수신: 실제 인물 초상 출력·미술 검수는 미완료.

세라 P12 despill 실험본은16절 승인으로 후보 반영. 기존 float HSV가 RGB(48,49,43)의 정확70°를 누락해298픽셀이 남는 문제를 정수 비교로 수정했다. 새33프레임 독립 HSV 검사 green0, alpha동일,32색. make의 공통 순서는 기존 import.pipeline의 key despill(모든 캐릭터)→medianCut, Sera 전용 공통팔레트 앞 추가 정리는 유지; 적 녹색 피부를 Sera 정리 함수에 넣지 않는다.
