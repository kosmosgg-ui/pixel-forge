# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P4**

## 로그
- [P4] 중단(결정 대기) | 완료: form.outline-thin, Animation·anims·overrides·motion 스키마, 타임라인(inbetween 앞/뒤만·ease·정수 스냅), humanoid-34-v1.anims.json 4종, 애니 렌더(rest 원점·전 프레임 공동 예산·fx flash/arc·좌향 flipX), forge render --anim·crowd, QA 애니 판정(최악 프레임 기준)
  - 현황: 테스트 162개 통과(골든 갱신). build-all: warrior anim.flicker 4px(attack 3~4프레임), 3종 모두 cleanup.orphans 4~5(임계 2), rogue form.detail-min 3. bounds.canvas는 death 포즈 dy·마법사 overrides로 해결
  - anim.flicker 수정 3회(① 고립 정리 파츠 단위 ② 셰이딩·섬 정리를 파츠별 원본 모양에서 ③ 고립 정리를 선 긋기 전으로) → 15/8/1px → 4/0/0px
  - 원인 가설: ① 남은 전사 깜빡임은 공격 중 팔·검이 허벅지를 일부 가려 고립 정리의 같은 파츠 이웃 집합이 달라짐 → 고립 정리도 파츠별 원본 모양 단계로 옮기면 해결 예상 ② orphans 증가는 정리 뒤에 내부선·눈을 그려 같은 색 이웃을 잃은 픽셀 ③ 정적 깔끔함(프레임별 정리)과 시간 안정성(애니 깜빡임 0)이 충돌
  - 필요한 결정: QA cleanup.orphans를 (A) 선·눈(mark) 이웃 때문에 생긴 고립은 제외 (B) 지금처럼 최종 이미지 기준 유지 + orphanMax 상향 (C) 선 그린 뒤 2차 정리 추가(깜빡임 재발 위험)

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
