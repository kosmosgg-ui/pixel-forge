# 지시문 P11 — 병합·원본 보관·엔진 고정·실제 검기·검수 패키지 (사용자 승인 2026-10-23 13:13)

작성: 클로드(총괄). 실행: 코덱스. 대상: pixel-forge(main), seonggeom(codex/g2-approved-handoff).
범위 밖 판단이 필요하면 구현하지 말고 보고의 `질문:` 줄로 남긴다. 그림 생성 API 호출 금지.

## 0. 승인 범위 (이번 지시로 허용되는 것)
- 허용: pixel-forge `codex/g2-approved-handoff` → main 병합(fast-forward 또는 merge 커밋, 강제 푸시 금지).
- 허용: seonggeom `codex/g2-approved-handoff`에 커밋 추가. **seonggeom main 병합·정식 에셋 승격·전투 수치·히트박스 변경 금지**(Gate C 전).
- 허용: Godot 기준 버전을 4.7.2로 문서·스크립트에 고정.
- 금지: 바이블 수치 변경(이미 승인된 것 외), 기존 후보 PNG 덮어쓰기, 새 의존성.

## 1. pixel-forge 병합 (먼저)
1. `git fetch && git checkout main && git merge --ff-only origin/codex/g2-approved-handoff`(ff 불가면 `--no-ff`, 충돌 시 중단·보고).
2. `pnpm install && pnpm build && pnpm test` → 결과 줄 기록. 기준: 301 passed 이상, 실패 0.
3. `node scripts/check-rules.mjs` exit 0.
4. 푸시. 브랜치는 삭제하지 않는다.

## 2. 원본 보관 규칙 (원본 유실 재발 방지)
문제: data/import·out은 git 제외라 세션이 바뀌면 원본·state가 사라졌다.
1. 새 git 제외 아님 경로를 만들지 말고, **별도 비공개 브랜치 `art-source`**(main 병합 금지, art-inbox와 같은 원칙)에 아래만 커밋한다:
   `art-source/<actorId>/<action>_<dir>/<timestamp>.png` + `.intake.json` + 참조 이미지 `refs/<name>.png` + `state.json` + 사용 spec 사본.
2. `forge intake` 성공 시 위 구조로 복사하는 `--archive <dir>` 옵션 추가(cli만, 순수 패키지 변경 없음). 기본 꺼짐, 문서에 사용법 3줄.
3. 복원 명령 `forge restore <actorId> --from <dir>`: art-source 구조 → data/import 상태 복원. 해시 불일치 시 중단.
4. 테스트: 합성 입력으로 archive → 삭제 → restore → make 결과 해시 동일.
5. 사용자가 이번에 줄 파일: 세라 참조 3장(sera_ref·sera_turnaround·sera_size_ref)과, 남아 있으면 동작 시트 5장 원본 PNG. 받으면 intake(--archive) 후 art-source에 커밋. **JPEG 재저장본은 원본으로 등록하지 않는다**(provenance에 `derived: true`로만).
   - 사용자에게 요청 문구를 보고 `질문:` 줄 대신 `요청:` 줄로 한 번만 남긴다.

## 3. Godot 기준 버전 4.7.2 고정 (seonggeom)
1. 작업 환경에 Godot 4.7.2 stable(공식 빌드, linux x86_64 + export templates)을 설치. 설치 불가(네트워크 차단)면 중단 사유를 보고하고 4.6.3 결과를 "참고"로만 표기.
2. `scripts/codex/dev_check.py`에 기대 버전 4.7.2 검사 추가(다르면 경고 + 결과에 버전 기록).
3. 4.7.2로 재검: editor import, g1_manifest, g1_state, g1_actor_view, g2_timing, g2_presentation, demo_050_integration. 4.6.3 대비 결과 표(건수/실패).
4. Windows 내보내기: 기존 export_presets 사용해 `.exe+.pck` 빌드만(실행 검증은 사용자). 산출물은 git에 넣지 않고 6절 패키지에 포함.

## 4. 실제 공격 사양에서 검기 재생성 (pixel-forge + seonggeom)
문제: fx_slash_1~3은 range 90·각도 90/110 기준인데, 데모 기본 공격은 `data/16_gameplay_v04.json` families.*.levels[type=primary]의 reach 110·angle 100(레벨에 따라 140 등)이다. 지금은 도형 검기로 대체 표시 중.
1. **사양 표 추출(seonggeom, 읽기만)**: 16_gameplay_v04.json의 모든 family·level에서 primary의 고유 (reach, angle) 쌍과 wave(waveRange, waveWidth) 쌍을 뽑아 `docs/DEMO_DEV/FX_ATTACK_SPEC_TABLE.md`에 표로(family, level, reach, angle, 사용 여부). 04_skills.json의 angle 항목도 같은 표에 출처별로. 수치는 바꾸지 않는다.
2. **환산식 확정**: 기존 노트 "반지름 30px = range 90"의 근거를 코드(com_001.gd 부채꼴 그리기·히트 판정 단위)에서 확인해 `radius_1x = f(reach)`를 한 줄로 기록. 근거 없으면 히트박스를 디버그 오버레이로 그린 캡처에서 실측. 기준: **검기 바깥 호 = 판정 reach의 90~100%, 각도 = 판정 angle ±5°**.
3. **pxl 생성**: sg_fx.px.js의 `slash(name, R, sweep, …)`를 표의 고유 쌍마다 호출하도록 데이터 구동으로 변경(쌍 목록은 JSON으로, 코드에 수치 하드코딩 금지). id 규칙 `fx_slash_r{reach}_a{angle}`(+콤보 단계 접미 필요 시). 8방향 사전 생성·fxPalette만 사용·안쪽 투명 원칙 유지. 기존 fx_slash_1~3은 삭제하지 말고 남긴다.
4. **게임 연결**: actor_bindings.review.json에서 현재 primary의 (reach, angle) → 해당 fx id 매핑. 일치하는 fx가 없으면 지금처럼 도형 유지. 레벨업으로 angle이 바뀌면 다음 공격부터 해당 fx.
5. 테스트: (a) 표의 모든 사용 쌍에 fx 존재, (b) 렌더 계약 — 오버레이 캡처에서 호와 판정 경계 차이 ≤ 10%, (c) 매핑 없음 → 도형 fallback.
6. wave(waveRange 360 / waveWidth 42)는 fx_beam과 크기만 비교해 표에 "일치/불일치"만 적고 이번엔 연결하지 않는다.

## 5. 기존 후보 경고 처리 (판단만, 재변환 금지)
- 세라 머리 폭 14→19px: idle·attack 시작·attack 5번 서기·death 0을 같은 발 기준선에서 나란히 그린 시트 1장(2배) 생성. 원근·자세 차이인지 크기 오차인지 판단에 쓸 측정값(머리 폭·키·어깨 폭) 표 첨부. 결론은 내지 말고 시트+표만.
- 오크 대장 death 잘림: 원본(복원되면) 또는 후보에서 잘린 프레임 번호·잘린 변(px) 기록. 재요청 필요 여부는 클로드가 판정.
- 오크 walk 0·3 뜸 1~2px: 발 앵커 보정으로 해결 가능한지(행 이동만, 그림 수정 없이) 실험 결과만.

## 6. 사람 검수 패키지 (사용자 → 클로드 전달용)
`review/P11_review.zip` 하나(git 제외, 사용자에게 파일로 전달):
- `00_summary.md`(10줄: 무엇을 보는지·통과 기준)
- 캡처: 4.7.2 기준 장면 캡처 중 대표 **12장 이하**(PRO-01 마차·CH1-01 군집·CH1-02 대장 3패턴·직업 체험 각 2~3장), 파일명에 장면·상황.
- `sheets/`: 5절 세라 크기 시트, 새 검기 8방향 시트 + 판정 오버레이 캡처 2장, 팔레트 전후 lineup.
- Windows `.exe+.pck`(3-4) 및 실행법 2줄.
- 크기 제한: 이미지 합계 20MB 이하, 낱장보다 묶음 시트 우선.

## 7. 수락
- pixel-forge main = 병합 커밋, `Tests N passed`(N ≥ 301, 실패 0), 규칙 검사 통과.
- archive/restore 왕복 테스트 통과.
- Godot 4.7.2 버전 문자열 + 3절 검사 결과 표(또는 설치 불가 사유).
- FX_ATTACK_SPEC_TABLE.md + 환산식 1줄 + 새 검기 QA 경고 0 + 4-5 테스트 3종 통과.
- 5절 시트·표, 6절 zip 전달.

## 8. 보고 (이 형식 그대로, 10줄 이내)
```
[P11] pixel-forge <커밋> / seonggeom <커밋>
완료: …
수락: <명령> → <결과 줄> (항목별 한 줄)
경고·불일치: …
요청: (사용자에게 필요한 파일·결정)
질문: (범위 밖 판단)
패키지: review/P11_review.zip (<크기>)
```
실패 로그는 마지막 25줄만 별도 블록.
