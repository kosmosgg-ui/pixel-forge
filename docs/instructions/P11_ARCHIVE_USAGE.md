# P11 원본 보관/복원 — opt-in CLI

```sh
pnpm forge intake inbox/hero_sera__walk_side.png --archive out/art-source-worktree/art-source
pnpm forge restore hero_sera --from out/art-source-worktree/art-source
# 원본 PNG/참조/state/사용 spec만 검토한 후 art-source worktree에서 commit; main에 merge하지 않는다.
```

현재 `out/art-source-worktree`는 로컬 orphan `art-source` 브랜치이며 main이 추적하지 않는 기존 out/ 아래에 있다. archiveActor는 actor의 원본PNG/메타·참조·사용 spec를 보관하고 state.json의 $archive에 복원경로/파일hash/상태hash를 기록한다. refs의 여러 버전은 이름__timestamp로 보존한다. 복원은 모든 경로·해시 검증 후 data/import와 out/make에만 쓴다. state.json의 items는 그대로 복원한다. 원본은 재인코딩하지 않는다. archive 기본값은 꺼짐.

현재 받은 JPEG4장은 원본 등록하지 않았고 review 패키지의 수령목록에서 derived:true로만 표시한다. 참조3장과 원본PNG5종이 없으므로 source archive에 PNG를 커밋하지 않았다. 기존 파생 후보 baseline은 원본 archive에 섞지 않는다.

GitHub는 브랜치별 비공개 설정을 제공하지 않으므로 art-source는 원격 push하지 않았다. 원본 수령 후 비공개 보관 저장소/원격 확인이 필요하다. 빈 로컬 브랜치 예약 커밋만 있으며 main에 병합하지 않는다. baseline/원본·기존 후보는 변경하지 않는다.

## P12 승인 반영(최신·기존 보류 설명을 대체)

기본 안내 보관 대상은 **seonggeom 비공개 저장소의 orphan art-source**이며, pixel-forge 원격에는 원본을 올리지 않는다. `--archive out/seonggeom-art-source/art-source`(seonggeom worktree)로 복사하고 해당worktree에서만 commit/push한다. 옵션 자체는기본꺼짐이다. ab5c871 원격push완료·main/다른branch절대미병합. 원본미수신으로현재PNG커밋0. 과거pixel-forge로컬빈art-source는사용중단하되삭제하지않는다.
