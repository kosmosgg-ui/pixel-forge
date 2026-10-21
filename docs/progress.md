# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P2**

## 로그
- [P1] 완료 | 완료: raster·palette·hex, OKLab/OKLCh+색역(C 이분 탐색 20회), makeRamp(최단 각도 hue), bible-palette(hex 공유), 도형 5종(바운딩 박스·해석적 회전·법선), mask-grid·rotsprite, cleanup 2종, PNG io(옵션 고정), `forge palette`
  - 수락기준: build·test 통과(20파일 68테스트, 골든 1개), `forge palette sample-v0` → out/palette/sample-v0.png(12재질 49색)
  - 팔레트 평가: 어두운 쪽은 청보라, 밝은 쪽은 노랑으로 도는 hue shift가 재질 전반에 고르게 보임. 단 cloth_white·gold 최상단이 #ffffff로 포화되어 서로·fx 흰색과 인덱스 공유(backlog 기록)
  - 해석 메모: 타원 판정식은 박스 중심 (w/2, h/2) 기준으로 구현(문서에 적힌 cx=(w-1)/2와 x+0.5를 함께 쓰면 반 픽셀 어긋나 w=6 원이 비대칭이 됨)
  - 다음: P2(spec 스키마 + 정지 프레임 렌더러)
- [P0] 완료 | 완료: 모노레포(pnpm·TS5.9 strict·vitest4) + 패키지 7개 골격, core ForgeError/종료코드, mulberry32 PRNG, cli `forge --version`, 범용 툴로 방향 확정(데모 조사 삭제, 예시 바이블 `sample-v0`, `roleColorKey`, P5는 엔진 무관 `dir` 어댑터)
  - 수락기준: install·build·test 통과(8파일 13테스트), `forge --version` 한 줄 JSON, sample-v0 바이블 존재 — 전부 통과
  - 다음: P1(래스터·색·도형·PNG 입출력)
