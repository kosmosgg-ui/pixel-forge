# AUTOPILOT BATCH-1 — 2026-10-23

첫 점검 지점: DEMO_AUTOPILOT 7절의 Q4 승인 대기. Q0 승인을 기다리는 동안 독립 Q3/Q5/Q6/Q8을 진행했다. CP-M1 또는 전체 대기열 완료 보고가 아니다.

## 커밋·보호 범위
- 마스터 원문 고정: seonggeom 1617371 / pixel-forge 711ce56. 두 저장소 docs/instructions/DEMO_AUTOPILOT.md와 docs/DEMO_DEV/DEMO_AUTOPILOT.md는 첨부 원문과 동일.
- 구현: seonggeom d1b002b / pixel-forge a9ec63b. 원본: seonggeom private orphan art-source 14fe669, 병합 없음.
- P13+P12 부록16~18은 기존64f437c/d844a27에서 완료. 14/15 사용자 둘 다 승인 적용. 이번 P13 보호검사도 19파일(main.tscn/project.godot/17JSON) 불변, 승인 대본 바이트 불변·ko498키·대사99키.
- 기본 바인딩/정식 에셋/전투·판정·충돌·저장 불변. 새 이미지 게임 연결은 없음. 새 컷인 표시 프로필은 매니페스트 opt-in이고 기존 왼쪽 컷인도 회귀 통과.

## 실제 결과
- Q0: 첨부 크롭3장 fixed 참조 고정·SHA 확인. 고해상도1536×1024 기준원화+front/side/back 통합 보드 A/B 생성, BLOCKED-APPROVAL. 선택 전 기존 고정 참조 보존. portrait/cutin/prop/ground/keyart 데이터 문구·골든·수령 경로 준비.
- Q3: 세라 초상1차 칸 경계 접촉 불합격→2차720×720 4장, 접수원·미아 각1장 변환. green0/잘림0/머리top40, 머리너비 proxy 편차 세라2.406%·NPC4.885%. 원본 세라 시트1254×1254(1536 권장은 미달, 필수 하한은 아님). 동일인 부위별 ΔE≤12 인증은 UNVERIFIED. 초상은 기술 QA와 최종 미술 합격을 구분해 NEEDS-CLAUDE, 게임 미연결.
- 보정 Q3_lineup: 익명1=B/2=D/3=C/4=A48, 공개 전에 순서2<3<1<4로 재판정 일치. 관찰: ①리본·갈색 눈·은/금 갑옷은 읽힘 ②일러스트의 매끈한 선은 48px 도트와 다른 매체 ③부위별 색·동일인 및 일러스트 등급은 이 도트 기준만으로 확정할 수 없어 등급 보류. 유도 재시도 없음.
- Q4: 레오나 디자인2안, BLOCKED-APPROVAL. Q4b 초상은 미생성.
- Q5: 1차 전신으로 상반신 규격 불합격, 2차 가장자리 ink681/크로마86.912%, 3차 ink560/크로마89.246%로 FAILED-3. 모두 원본 보존, 스테이징 quality=rejected, 게임 미연결. 템플릿 전체중단 조건인 동일 사유3개 항목 연속 실패는 아님.
- Q5 코드: 오른쪽→중앙 .35초/최대높이70%/HUD80px 보호/linear/전투시간 불변. 합성 fixture9검사 및 Xorg/Mesa 실화면 확인. Q5_placement_SYNTHETIC.png는 파란 사각형 검사이며 실제 컷인 합격 그림이 아니다.
- Q6: GUARD/SWIFT/RUNE 각각 정면+3/4 보드 A/B, 총6안. 전부1536×1024/바깥 크로마100%/edge ink0, BLOCKED-APPROVAL. 새 의상 최종 디자인·동일인 합격을 주장하지 않음.
- Q8: GUARD 금/SWIFT 청록 --variant 9쌍씩18후보, QA경고0. 기존 대비 형태·알파·앵커·행·재생시간 동일18/18. pxl 코드 보호막 링·2연격 잔상2후보/QA경고0·골든 해시. 후보 스테이징만, 게임 연결 전. RUNE 보라는 승인13색에 없어 BLOCKED-APPROVAL. 룬3단/반경85 폭발 및 직업별 게임 연결은 미완료.

## 수락·제한
- pnpm build PASS; pnpm test --testTimeout=20000 → Tests321 passed /2 skipped. skipped2는 docs/integrated/P8/samples/sera_gpt_raw.png와 sera_ref_tall_gpt.png 부재로 describe.skipIf(!has)가 건너뛴 기존 골든, pxl 검사 실행됨. Node22.23.4/pnpm10.28.0/pxl2e72b9a 핀 유지. rules PASS, git diff --check PASS.
- dev_check.py 12 suite선택/고유19검사 →587 passed/0 failed; Godot4.7.2 공식. GUI 합성 컷인9/0. p13_verify.py 보호파일19/대사99/누락키0.
- scripts/autopilot-audit.py →fixed3/생성요청16/보존원본19 SHA PASS. 모델은 도구 미보고로 gpt-image (Codex 내장, 모델명 미확인). 유료API·새 의존성 없음.
- 이번 생성16장/누적16장(Q0=2,Q3=3,Q4=2,Q5=3,Q6=6). 데이터에서 조립한 실제 요청 바이트와 원본 SHA를 private art-source generation-records/에 저장.
- 승인 전 새 기준 참조 채택 없음, 원본PNG는 pixel-forge Git에 없음. 후보가 기술검사만 통과했다고 게임에 연결하지 않음.
- 미해결: 동일인 ΔE 자동 인증/일러스트 B등급 판정, Q5 재시도 한도, RUNE 팔레트 충돌. CP-M1 플레이 가능한 전체 아트/12캡처/새 Windows는 아직 미달.
- Windows는 이번 ZIP에 없음. 이전 P13 검수 빌드는 별도 review/p13-download/P13_review.zip, 이번 아트/코드 반영판으로 부르지 않음.

## 사용자 선택 — 시트 왼쪽 A / 오른쪽 B
- sheets/Q0_sera_A_B.png: Q0 A 또는 B, 또는 수정. 승인본만 새 fixed 참조로 등록.
- sheets/Q4_leona_A_B.png: 레오나 A 또는 B, 또는 보류.
- sheets/Q6_GUARD_A_B.png / Q6_SWIFT_A_B.png / Q6_RUNE_A_B.png: 직업별 A 또는 B, 또는 보류.
- 질문: RUNE 보라에 필요한 fxPalette 확장을 승인할지? 제안3키 p=#d8b5ff/P=#a26ae3/q=#63408f(총16색)는 docs/proposals/AUTOPILOT_RUNE_PALETTE_PROPOSAL.json에만 기록, 현행13색 유지·미적용.

다음 독립 항목은 Q9 전장 A/B·소품 시험. Q1/Q2는 Q0 새고정참조 승인, Q4b는 레오나 승인, Q7은 직업별 의상 승인 후 진행. Q3 동일인·일러스트 등급은 클로드 판정 요청. Q5는 FAILED-3이므로 추가 생성은 한도 재승인/클로드 문구 수정 전 보류.

패키지 이미지: 총19,966,212bytes(20MB 이하). 승인시트/보정/FX/합성캡처는 픽셀동일 PNG 무손실 압축; Q3 전체/실패3회 시트는 용량 제한용 JPEG 미리보기. 원본은 private art-source, ZIP에 신규 생성 원본PNG 자체는 없음.
