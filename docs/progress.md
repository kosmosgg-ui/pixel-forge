# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P8-9 대기(세라 생산 — G1·P9 진행)**

## 로그
- [P11] 0절 범위 구현·검수패키지 준비 / 원본·비공개 원격 확인 대기.
  - main ff(ad51afb)·설치/build/기준301pass·push, CLI archive/restore 합성왕복PNG+manifest동일.
  - 최종 pnpm build && pnpm test: Tests304 passed/2 skipped(원본골든2부재), pxl포함·규칙exit0.
  - 16게임play primary20행→고유6쌍JSON·검기8방향3프레임호90~100%/angle±5°/안쪽투명, QA경고0.
  - 공식Godot4.7.2/templates SHA512·153/0+FX16/0·대표12장/overlay2장·Windowsexe+pckbuild0.
  - 기존후보는측정/행이동실험만·미적용. JPEG4장은derived만,원본PNG미수신·로컬art-source만(API Forbidden).
  - review/P11_review.zip(Git제외), sheets/P11_lineup.png·측정표·실제캡처·Windows포함. 이미지합계約3.5MiB.
  - 새의존성/바이블수치/원본PNG덮어쓰기/게임main병합/정식승격없음. 다음은클로드검수·원본수령·비공개보관확인.
- [P11 계획] 0절 승인 범위만: main ff병합·설치/build/test/규칙 확인 후 push.
  - CLI archive/restore와 합성 왕복 해시 검증, 원본 PNG 미수신/JPEG 구분.
  - Godot4.7.2 공식 빌드·템플릿·기대버전 및 지정 회귀/Windows 빌드.
  - 읽기 전용 공격 사양표·JSON 구동 검기·review 바인딩·계약검사.
  - 기존후보 경고는 측정/행이동 실험만, review/P11_review.zip≤20MB 이미지·8절보고.
- [P10/G2 공정 보완] 구현·기술검증 완료 / 미술 ART_HOLD.
  - 사용자 확정: 세라32/적24는 캐릭터 전체 공통 팔레트. 별도5종31/18/11/12/14색, 알파·형상·프레임 불변.
  - 명시적 baseline 병합/누락 덮어쓰기·시간충돌 차단, 출력파일·state 예외복구, 원본/state 창작 없음.
  - 컷인전용 문구 분리. 게임 보스·시간·이동공격·실제FX/컷인 표시, 실제검기 사양불일치는 도형유지.
  - pnpm build && pnpm test: Tests301 passed/2 skipped(원본PNG2부재), 규칙검사 통과, pxl고정통합 실행.
  - Godot367/0·실제GUI30+팔레트30+fixture2장. Windows/사람검수는미완료, 정식에셋/기존PR/17JSON 보존.
  - docs/proposals/G2_REMAINING_IMAGE_CONTRACTS.md 및 HANDOFF_CODEX 후속절, out/process-fix/report.json·palette-lineup.png.
  - 다음: 기존참조3장/새정면·뒷면3요청수령, 실제검기 변형·목표물/직업규격 확정 후 소량제작.
- [P10/G2 공정 보완 계획] 기존 후보 보존/명시적 baseline 병합·상태 rollback부터 구현.
  - 신규 원본 없이 기존 RGBA/메타를 보존하고 누락 덮어쓰기를 차단, 의미 있는 회귀 추가.
  - 게임의 보스 패턴/시간 메타·이동 공격·FX/컷인 표시를 표시 계층에서만 수정.
  - 색예산/새 아트 규격은 별도 결정으로 두고 기존 데이터·정식 바인딩·PR 보존.
- [상시 개발 지시] 최소 토큰·최소 변경·기존 구현 재사용·중복 작업 억제·측정 기반 최적화를 양 저장소 AGENTS.md에 기록. 정확성/필수 검증/데이터 보호 유지.
- [개발 기준 인계 확인] AGENTS·DECISIONS·승인/구현 계약·규칙 스크립트·최신 작업 기록의 Git 추적/원격 일치 확인.
  - HANDOFF_CODEX 0절에 규칙·게임 기준·현재 검증·다음 요청 진입점 연결, 과거 기준점/대기 문구 구분.
  - 새 규칙/정사 변경 없음. 실제 원본 미복원·건너뜀2건·Gate C/정식 교체·기존 PR 보류 유지.
- [G2 후보 검수/요청 준비] 실행 완료 / 미술 승인 대기.
  - Xorg/Mesa·Godot4.6.3 실제 후보 게임화면30장, 고정프레임5종9개, G1-ACTORVIEW13/0. 임시 연결은 별도 복제본만.
  - 세라는 옆 행1개로 앞뒤 이동도 대체 표시. 크기차·오크 접지·대장 원본 잘림은 유지, 신규 미술 등급 없음.
  - idle/walk의 망토 잔재 제거, idle_back 조립 문자열 골든 의도적 갱신. 정사·프레임수·게임수치 불변.
  - pnpm build && pnpm test: Tests294 passed/2 skipped(원본2장 부재). 규칙 검사 통과.
  - 다음3건 idle_front4/idle_back4/walk_front6 요청 txt·ZIP 생성, NEXT_IMAGE_REQUESTS.md에 참조3장/전달규칙 기록.
  - 원본/state 미복원으로 forge prompts remaining18은 실제 잔여수가 아님. 기존 옆 후보는 중복 요청하지 않는다.
  - 상세 seonggeom G2_CANDIDATE_REVIEW.md, 정식 아트/기존 PR/전투/저장/17JSON 불변. Gate C PENDING.
- [G2 후보 현황 재확인] 사용자 첨부5장과 seonggeom art/candidates/의 기존 픽셀 후보 대응 확인.
  - 세라33·고블린14·늑대15·오크15·대장37프레임 PNG/매니페스트 존재, 알파0/255·승인 셀/앵커·비어 있지 않은 프레임 검사 통과.
  - 옆 방향 동작 시트는 변환 완료. 원본 data/import는 미복원이며 JPEG→PNG 단순 변환으로 대체하지 않음.
  - 기존 QA: 세라 크기 차이, 오크 접지, 대장 흔들림/원본 잘림·5종 밴딩 경고. 미술 등급/정식 승인 아님.
  - 다음: 세라 정면·뒷면 idle/walk·컷인 등 미확보분. 상세 seonggeom docs/DEMO_DEV/G2_CONVERTED_ASSET_STATUS.md. 정식 교체/PR 병합 없음.
- [P10/G2] 승인 6건 실행 반영·검증 완료(2026-10-23) | ART_HOLD / 사용자 Gate C PENDING.
  - 바이블 fxPalette 13키→pxl 생성 소스·QA 연결, metal_blade 추가·무기 검사 활성, hero32/적24 유지; $history 보존.
  - 승인 sheetSize 5종·발밑 여백 보존, 초과 입력 중단; 기존 후보·정식 바인딩 미변경.
  - PRO-01 고정 피난민 마차 프롬프트·G1 안내/HUD, 3직업 실루엣 후보 actor/수동 요청 12개 생성(이미지 생성 아님).
  - Node22.23.4/pnpm10.28.0 설치·build 성공 기준선 확인; 최종 build/test: Tests 294 passed | 2 skipped, 규칙 검사 통과.
  - 원래 skipped3 = 원본 PNG 골든2 + pxl1. PXL_BIN 반영 후 pxl 통합1 실행·통과. 원본2장 부재로 골든2만 skipped.
  - pxl /workspace/tools/pxl = 2e72b9ad5fae3709b1bcd81ea6a3cfc5eafbdb90(clean). fx12종 out/approval-fx 생성·QA 경고0. --out 없이 실행은 로컬 대상 허용목록 부재로 중단됨.
  - seonggeom G1=4c6afe6, Godot4.6.3 격리 검사 manifest11/state27/DEMO050 52 통과. 인계4.7.2·GUI/미술 검수 아님.
  - 다음: 원본 2장·새 직업/마차 이미지를 사용자가 전달하면 intake/make·미술 검수. 기존 PR 병합·정식 교체·전투/저장/17JSON·.claude/ 불변.
- [P10/G2 승인 기록] 6건 결정 완료 / 구현 반영 BLOCKED | 사용자 직접 응답을 proposals/P10_G2_CODEX_APPROVALS.md·G2 DECISIONS에 기록.
  - 승인: fxPalette 13키 / metal_blade #c8d4dc·3단·metal / cellGrow 확대 규격.
  - 유지·선택: 세라32색·적24색 / PRO-01 고정 피난민 마차 / GDD §8.3 전직 실루엣 후보 제작.
  - 미승인 유지: 정식 승격·기존 PR 병합·전투 수치·신규 view/kind. ART_HOLD / Gate C PENDING.
  - 바이블 $history·실행 소스·기존 후보·게임 코드·17JSON 미변경; 승인 기록과 구현 완료 분리.
  - 규칙 검사·문서 링크·보호 해시 확인; pnpm build/test는 설치 차단 상태로 PASS 근거 없음.
  - 다음: 환경 복구 후 설치·전체 검사 → 승인 6건 적용·관련 검사. 이미지 생성 API 호출 없음.
- [P9-M Codex 인계] 파일 준비 완료 / 환경 BLOCKED | main 기준 35c4b79·G1 기준 4c6afe6 전체 트리 해시 복원·검증.
  - 인계 AGENTS.md·docs/HANDOFF_CODEX.md·scripts/check-rules.mjs는 사용자 ZIP과 바이트 동일.
  - node --check scripts/check-rules.mjs / node scripts/check-rules.mjs: exit 0(변경 TS 0, 관련 테스트 미호출).
  - 환경 Node 24.19.0 / pnpm 11.25.0; 기준 Node 22 / pnpm 10.28.0과 다름. 엔진 최소 >=22는 충족.
  - pnpm install: 프록시 소켓 EPERM·온라인 META_FETCH_FAIL·오프라인 NO_OFFLINE_META, 의존성 설치 실패.
  - pnpm build / pnpm test: exit 1, tsc / vitest 없음. Tests N passed 근거 없음; 전체 검사 PASS 아님.
  - pxl 2e72b9ad 런타임 54파일을 저장소 밖 복원·Git blob SHA 확인, node /workspace/tools/pxl/bin/pxl.js --help exit 0(전체 clone 아님).
  - seonggeom 별도 복제본 Godot 4.7.2 headless: G1-MANIFEST 11/0, G1-STATE 27/0; GUI·전체 데모·미술 검수 아님.
  - 바이블·rules·후보·정식 경로·.claude/·CLAUDE.md·전투·17JSON 불변; 인계 파일만 main 제출, 기존 PR 병합 없음.
  - 다음: 네트워크/의존성 복구 후 pnpm install && pnpm build && pnpm test 재개, 미결정 6건 질문 발행(후속 승인 기록 참조). ART_HOLD / Gate C PENDING.
- [P8] 마감(P8fix, 사용자 승인) | 기준 A 교체(6등신 세라 47×64), 재현성 = 발 정렬 실루엣 IoU + ΔE(silhouetteMatch, Spec outline none), 잘림 정의 고정(알파 ≥ 128 픽셀이 바깥 1px — 골든 sera_gpt_raw 1개 #19 오른쪽), 바이블 display 1280×720·2배·스냅 2(640×360 취소), 초록·마젠타 배경 테스트, colorBudget 32 승인
  - 수락: pnpm test → Tests 264 passed(test-runner, 원본 골든 2개 실행), 재현성 IoU 0.9985·ΔE 0.0445, art-judge v2 보정 유효(새 A), sera import B–A
  - code-reviewer: 높음·중간 0, 낮음 3 → 2 수정(ΔE 색 캐시·잘림 1회 계산), 1 backlog(골든 원본 위치)
  - targets.local.json: seonggeom 클론 없음 → 작성 안 함(G1에서)
- [P8] 1~8 완료(9 전 정지) | import 모드(packages/import 순수: 가장자리 배경·이진화·연결 성분·줄·잘림·dedupe·공통 배율 BOX·median-cut·발 앵커·전 프레임 외곽선), QA(palette-delta·jitter·identity), forge import/--probe, data/projects/seonggeom(바이블·target·수락 Spec), godot-rowsheet(후보 폴더만, candidate·provenance 11·qa)
  - 수락: pnpm test → Tests 260 passed(test-runner), 합성 5종 통과, manifest 키 구조 테스트 통과, art-judge sera_gpt_raw B–A(보정 유효)
  - 불일치: probe 잘림 2(기대 3), ref_tall→A 재현 차이 97%(기준 ≤5%, A bbox 32×59 vs 48×64) — 사용자 확인 대기
  - code-reviewer: 높음 0, 중간 4 → 2 수정(anchor 바이블 우선, 바이블·타깃 경로 io.path-escape), 2 backlog(수치 rules 이전 제안, idle 고정)
- [P7] 완료(마감, 사용자 승인 P7close) | 0 생물 기본 모드 결정(→ 바이블 defaultCreatureMode로 일반화, 스키마 기본 atoms), se(yaw −35°) 1방향 + manifest mirror. 1 렌더 회귀 수정(POC 툰·명도 순위 램프·dark 외곽선·소품 가시성 경고·바이블 pixelsPerUnit 17.72) 기술 수락. 판정 체계: 보정 세트 v2 + art-judge(축 "1배 게임 화면 SD 스프라이트 완성도"), pixel-reviewer 폐기, forge lineup
  - 수락: pnpm build && pnpm test → Tests 241 passed(test-runner), art-judge v2 보정 확인 유효(D<C<B<A), 기사 프리렌더 등급 D–C(기록만)
  - code-reviewer: 높음 0, 중간 6 → 5 수정(pose-distinct 방향 경계, 소품·lineup 테스트, prerenderDeps 경로, 검증 시점 문서화), 1 backlog(bpy 버전 캐시 키)
  - 이동: 2·3·5·6번과 나머지 서브에이전트·스킬 → backlog "prerender 트랙"
  - v1 보정 세트 무효 3회(축 미정의) → v2로 교체

- [P7-alt] 실험 완료(판정 보고) | 3D 프리렌더 → 도트: packages/render3d(Blender 래퍼, bpy 5.2.2 venv) + render/prerender.ts(재질·색 표 매핑, 2×2 다수결·눈 우선, 3단계 툰) → 기존 정리·외곽선·QA·pack. 모델 KayKit Knight·Skeleton_Minion(CC0, 저장소 제외, source.json). forge scene 추가
  | 캐릭터 | 방향 | 키 | QA | reviewer | 비고 |
  | kaykit-knight | s·se·e·sw | 45px(96 캔버스) | 통과 | 18/24 | 로봇 POC와 비슷, s·se에서 칼 가려짐, death 4~6 잡티 |
  | kaykit-skeleton-minion | s·se·sw(옆은 눈 안 보임) | 45px | 통과 | 17/24 | 정면 눈구멍 보임, 뼈 밝은 면 cloth_white, 무기 없음(모델에 없음) |
  - 렌더 시간: 프로브 + 본 렌더 각 ~25초(129·103프레임 × 3패스, 캐시). 깜빡임: anim.flicker 0(스키닝 메시라 비교 대상 없음 — 보조 지표 shade 변화 평균 104·86px/프레임쌍, idle 25px)
  - 시트: out/kaykit-knight/studio.png, out/kaykit-skeleton-minion/studio.png, out/prerender/review.png, out/scenes/kaykit-skirmish.png
  - 미제공: docs/prerender-poc/result-kaykit-knight.png(같은 zip 재업로드) → 로봇 결과와 비교

- [P6.5] 완료 | 그리드 파츠(재질:단계·@eye·@outline), frames 모드(base+patch), atoms 모드(관절 원점 아톰·각도 변형·upright), 시안 docs/quality-ref/target-grids.json, forge compare(시안 열·iou·diff·headDiff), review.json v2(sheetHash·12기준 관찰), shoot(당김 5px·−8°·시위 화살). 사용자 승인: 기본 모드(생물 = atoms, 아이템·리그 없는 생물 = frames, shapes = 시안용), humanoid-small-v1 비율, signature 15~40% 경고, 새 필수 QA anim.pose-distinct
  | 캐릭터 | 모드 | reviewer | 시안 대비 |
  | goblin | atoms | 22 | rest 실루엣 IoU 1.0, 색 예산 9 병합으로 30px(머리 19) 차이 → 예산 12 제안(승인 대기, 12면 diff 0) |
  | skeleton | atoms | 22 | 머리 diff 0, 곤봉(지시: 2×7·혹 3) 때문에 IoU 0.911(곤봉 반영 시안과는 diff 0) |
  | archer | shoot | 18 | aim 읽힘, draw·release 약함(시위 고정선·궤적 짧음 → backlog) |
  - 비교: out/sample/mode-compare.png(frames / atoms / 시안, 8배) — 두 몬스터 모두 atoms 우세. out/compare/review.png — 도적 atoms가 도형보다 깔끔(두건·눈·노이즈)
  - 수락: build-all sample 8/8, Tests 231 passed, code-reviewer 높음 0 · 중간 3 수정
  - 사용자 결정 반영: smallMonster 예산 9→12 → 고블린 diff 0·headDiff 0(reviewer 재검수 22), 스켈레톤은 곤봉 반영 시안(target-grids.json 갱신) 기준 diff 0 → 수락 기준 전부 통과

- [P6] 완료 | /forge 스킬, forge ref analyze·compare, 크기 등급 자동 맞춤(렌더 판정, sizeClassLock), 등급별 외곽선·기본 리그(smallMonster = dark·humanoid-small-v1, 예산 9), signature·form.signature, apply 검수 게이트(review-score, 입력+시트 해시, QA 통과 필수), form.head-clearance, fx 축척. 사용자 승인: 바이블 bone·metal_rust·large·smallMonster 설정, rules signatureMin
  | 캐릭터 | build 횟수 | reviewer 최종 | 비고 |
  | cleric | 3+4 | 21 | 방패 등 뒤로, death lie 오버라이드 |
  | archer | 3+8+1 | 19 | 화살통 등 대각선, 깃 어두운 톤 |
  | orc | 1+1 | 19 | 자동 large(64), 키 38 |
  | goblin | 4+2 → 재설계 6 | 22 | 소형 리그, mask 얼굴, signature ears 26.8% |
  | skeleton | 3+1 → 재설계 2 | 19 | 소형 리그, mask 해골, signature skull 28.9% |
  - 수락: pnpm build && pnpm test → 통과(test-runner), ref analyze CC0 exit 0 / 라이선스 누락 exit 1, build-all sample 8/8, reviewer 8종 ≥ 18(19~23), apply 8종 게이트 통과
  - code-reviewer: 높음 1(검수 크롭 PNG 2장이 저장소 루트에 커밋) 삭제, 중간 5 중 4 수정(제안서 승인 표기, 검수 키에 시트 해시·QA 통과 필수, ref 측정 스키마, fit 주석·리그 결정 문서) + 1 문서화, 낮음 backlog
  - 참고: 리뷰어 점수는 키 형식 변경 뒤 같은 값으로 재기록(렌더 바이트 동일)

- [P5 보정] 완료 | 사용자 승인 2건: rule form.held-thin-shade(두께 ≤3px held 몸체는 밝은 2단계, 손잡이·날끝 1px만 0단계), 출력 허용 목록 .forge/targets.local.json + --out @이름(gitignore, 사람이 작성)
  - 수락: Tests 202 passed (39 files). 도적 단검 날 배경 대비 최악 프레임 ≥ contrastMinL 0.18(실측 0.48). build-all sample 3/3

- [P5] 완료 | 완료: export(shelf 패킹 1px·결정론·pow2, Aseprite 호환 JSON hash+frameTags+duration — 근거 doc_exporter.cpp, manifest §10), forge pack, build는 QA 통과 시만 pack, Adapter 인터페이스 + dir 어댑터 + forge apply, forge watch(chokidar 4.0.3), docs/integration.md(Canvas 2D 로더 31줄), FORGE_VERSION 0.5.0(캐시 무효화)
  - 시트: 우향만 + rest 1프레임(duration 100), 좌향은 엔진 flipX. manifest pivot = 발밑
  - 수락기준: pnpm build && pnpm test -- --reporter=dot → Tests 199 passed (37 files). forge build rogue → pass:true, exit 0. forge apply rogue --target dir --out out/apply-test → written 3, exit 0
  - code-reviewer: 높음 1(대상 안 심볼릭 링크로 밖에 쓰기) 수정, 중간 4(폴더·비정규 파일 exit 3, 원자적 쓰기, watch add·error·색인 실패 로그, 남은 pack 파일) 수정 + 1(작업 폴더 밖 --out) 문서화·backlog, 낮음 3 중 2 수정 + 1 backlog
  - pixel-reviewer: 렌더 바이트 불변(골든 diff 0) → P4 마무리 점수 20/24 유지

- [P4 마무리] 완료 | 전사 투구 앞 열림(눈 둘레 피부 3×2)·튜닉 깃 턱 아래로, 도적 단검 = 곧은 날 7×2 + 날밑 1×4 + 손잡이 일직선, 공용 windup(spine -16·upperArmF -80·lowerArmF 40·weapon 10 → 무기·머리 겹침 0), forge review(캐릭터×애니 전 프레임, 바이블 배경, 4배, 애니 단위 줄)
  - QA: form.face-clear 프레임별 최악 판정 + 머리 위 held 0 + 눈 둘레 창이 얼굴 재질(투구 등 다른 재질 덮임 포함). 재현: 수정 전 warrior 눈 둘레 3/6, rogue·mage windup 가림 0.29·0.46. held-visible 부착은 손 → 같은 뼈 파츠(날밑·손잡이) 8-연결 도달로
  - 엔진: color.budget-fit은 3단계 이상 재질부터 병합(단검처럼 작은 재질이 한 색으로 뭉개짐 방지)
  - 수락기준: pnpm build·test → Tests 187 passed (34 files). build-all sample → pass:true 3/3, 필수 전부 통과, face-clear 통과(warrior 0.064, rogue 0, mage 0.035). 선택 실패: detail-min warrior 5·rogue 3
  - pixel-reviewer 20/24(mage 21, rogue 20, warrior 20), 시트 out/sample/review.png

- [P4 보정] 완료 | 원인: 정리 단계가 아니라 form.outline-thin이 1px 검 12px 중 11px을 외곽선 톤(L 0.28)으로 칠해 배경(L 0.27)에 묻힘
  - 완료: Spec held·decorative, rule form.held-min-width(2px, 미달 spec.held-too-thin), held 파츠 정리·얇은 획 보호, QA form.held-visible(필수), hit 3키(flash 60·flinch 120·recover 160), 무기 2px rect(검 15px·단검·지팡이), 전사 투구 슬릿·견갑·망토 단축·치마→골반, reviewer 24점 기준
  - 재현: 수정 전 build-all exit 2, held-visible warrior 1/12·rogue 1/8·mage 1/29
  - 수락기준: pnpm build·test → Tests 181 passed (33 files). build-all sample → pass:true 3/3(선택 실패: warrior·rogue form.detail-min 5/2)
  - pixel-reviewer 21.7/24(warrior 20, rogue 22, mage 23), 시트 out/sample/review.png. 남은 중간 2건 → backlog

- [P4] 완료 | 완료: form.outline-thin, Animation·anims·overrides·motion 스키마, 타임라인(inbetween 앞/뒤만·ease·정수 스냅·가장자리 거부), humanoid-34-v1.anims.json 4종, 애니 렌더(rest 원점·전 프레임 공동 예산·fx·좌향 flipX), 파츠별 셰이딩·섬·고립 정리(깜빡임 0), forge render --anim·crowd, QA 최악 프레임 판정·결정 A
  - 수락기준: pnpm build·test → Tests 176 passed (32 files). build-all sample → pass:true 3/3(선택 실패: rogue form.detail-min 3/2). crowd sample --count 50 --seed 1 → 320×180
  - code-reviewer: 높음 0, 중간 2(rules anim.inbetweenMs 승인 필요 → 사용자 확인 요청, inbetween 가장자리 → 수정), 낮음 4(죽은 인자 되돌림, 1건 backlog)
  - pixel-reviewer 15/20(warrior 15, rogue 14, mage 16). 키포즈: attack·death 분명, idle·hit은 rest와 구분 약함. 군중: 색으로 3종 바로 구분, 형태로는 mage만 확실
  - 다음 후보(승인·결정 필요): hit 키 추가(프레임 수 변경), 1px 검 → 2px(outline-thin과 충돌), idle·flinch 포즈 크게

- [P3] 완료 | 완료: qa 패키지(필수 6 + 선택 6 + 교차 2 검사, render 미참조), 렌더 meta 레이어·얼굴 통계, 컨택트 시트(체커+배경 2벌, 실패 위치 빨간 테두리, 시트 전용 팔레트), 캐시(파일 바이트+엔진 버전), forge qa·build·build-all(불합격 exit 2)
  - 수락기준: 테스트 145개 통과, build-all sample 3/3 합격(점수 1.0/1.0/1.0), 2회째 cached
  - 시트 루프 2회: banding(얇은 원기둥 팔다리 3단 띠)·detail-min → 팔다리 capsule→rect·두께 조정, 전사 견갑·손 확대. QA 정의 보정: detail-min 8-연결(대각선 획), banding은 2px 이상 이어진 띠만
  - code-reviewer: 높음 0, 중간 3(픽셀 루프 객체 생성) 수정, 낮음 3 수정 + 1 backlog
  - pixel-reviewer 14.7/18(warrior 15, rogue 13, mage 16). 남은 제안(P4 전 Spec 후보): 도적 단검 poly 2px 칼날·눈 pos [1,-1]·허벅지 h3, 전사 견갑 w5 h3, 마법사 팔 capsule w3. [엔진 의심] 1px line 무기에 외곽선이 양쪽으로 붙어 두 줄처럼 보임
- [P2 보정] 완료 | humanoid-34-v1(3/4, restPose = 전투 대기 자세, 바이블 defaultRig), 눈(form.face, 3/4는 2개), minCluster 3, 색 예산 자동 맞춤(color.budget-fit) + 소품 3단계, 전사 망토·튜닉으로 역할색, 샘플 3종 전환
  - 수락기준: 테스트 121개 통과(샘플 골든 갱신), rest 색 15/15/15(병합 4·1·3회), 다리 틈 줄 수 warrior 2·rogue 4, 눈 보임, 역할색 비율 43.9%/43.7%/62.0%
  - pixel-reviewer 점수 12/18(warrior 12, rogue 11, mage 13) → 제안 Spec 수정 5건 반영(도적 단검 7px·골반 초록, 전사 앞 견갑 축소·눈 2px, 마법사 모자 높이) — 반영 후 재검수는 하지 않음
  - 평가: 실루엣은 마법사(뾰족 모자+지팡이)·전사(망토+검)가 확실히 갈리고 도적은 무기가 작고 다리가 붙어 판독이 약했음(수정 반영). 역할색 셋은 바로 구분되나 어두운 배경에서 도적 하반신 갈색과 소재 톤 외곽선의 대비가 약함
  - [엔진 의심, P3 검토] 예산 병합 뒤 1~2px 밝은 조각 잔존(mage 로브·warrior 투구), selout 광원 쪽 외곽선이 ramp[0]이라 그림자와 구분이 약함
- [P2] 완료 | 완료: spec 스키마(Bible·Rules·Rig·Spec·PartShape)+refs, humanoid-side-v1 리그, rig 변환(정수 스냅), render 9단계(뼈 이름 미참조), cli validate·render, 샘플 3종
  - 수락기준: build·test 통과(23파일 108테스트, 골든 6개: 원 외곽선 3모드 + 샘플 3종), validate·render rogue 통과
  - 평가: 실루엣은 셋 다 한눈에 구분됨(전사 넓은 어깨·대각선 검, 도적 후드·좁은 몸·단검, 마법사 원뿔 모자·긴 로브·지팡이). 도적 초록·마법사 파랑은 역할색이 잘 읽히나 전사는 금속이 대부분이라 역할색(빨강)이 약함 → 다음 Spec 수정 때 가슴판을 줄이고 빨간 튜닉 면적을 늘릴 것
  - 메모: 세 캐릭터 모두 프레임 사용 색 17개로 예산 15 초과(P3 color.budget에서 잡힐 예정). Spec 규칙 추가: anchor·at·orient, proportions.height 축척, 외곽선 모드는 바이블 우선
  - 다음: P3(QA + 컨택트 시트 + build/캐시)
- [P1 보정] 완료 | 초록 대역(115~165°) 회피 hue 경로, L 0.18~0.93 클램프, 예약 색·재질 간 거리 ≥0.03(충돌 시 L 0.02씩 5회, 명도 순서 깨지면 중단) + shareWith, 재질별 외곽선 톤, 색 예산 15/7/30
  - 수락기준: 테스트 76개 통과(골든 갱신), 견본 확인: gold 그림자 #9b7018(h 79.7° < 기준 87.8°, 초록기 없음), #ffffff는 fx 행에만
  - 데이터 조정: sample-v0의 wood에 shareWith: leather(갈색 3종이 명도·hue가 겹쳐 충돌), cloth_white 4→3단계(기준 L 0.86이라 maxL 0.93 아래 밝은 단계 2개가 안 들어감). wood 기준색은 hair_brown과 충돌해 #74502e로 밀림
- [P1] 완료 | 완료: raster·palette·hex, OKLab/OKLCh+색역(C 이분 탐색 20회), makeRamp(최단 각도 hue), bible-palette(hex 공유), 도형 5종(바운딩 박스·해석적 회전·법선), mask-grid·rotsprite, cleanup 2종, PNG io(옵션 고정), `forge palette`
  - 수락기준: build·test 통과(20파일 68테스트, 골든 1개), `forge palette sample-v0` → out/palette/sample-v0.png(12재질 49색)
  - 팔레트 평가: 어두운 쪽은 청보라, 밝은 쪽은 노랑으로 도는 hue shift가 재질 전반에 고르게 보임. 단 cloth_white·gold 최상단이 #ffffff로 포화되어 서로·fx 흰색과 인덱스 공유(backlog 기록)
  - 해석 메모: 타원 판정식은 박스 중심 (w/2, h/2) 기준으로 구현(문서에 적힌 cx=(w-1)/2와 x+0.5를 함께 쓰면 반 픽셀 어긋나 w=6 원이 비대칭이 됨)
  - 다음: P2(spec 스키마 + 정지 프레임 렌더러)
- [P0] 완료 | 완료: 모노레포(pnpm·TS5.9 strict·vitest4) + 패키지 7개 골격, core ForgeError/종료코드, mulberry32 PRNG, cli `forge --version`, 범용 툴로 방향 확정(데모 조사 삭제, 예시 바이블 `sample-v0`, `roleColorKey`, P5는 엔진 무관 `dir` 어댑터)
  - 수락기준: install·build·test 통과(8파일 13테스트), `forge --version` 한 줄 JSON, sample-v0 바이블 존재 — 전부 통과
  - 다음: P1(래스터·색·도형·PNG 입출력)
