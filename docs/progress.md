# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P2**

## 로그
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
