# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P1**

## 로그
- [P0] 완료 | 완료: 모노레포(pnpm·TS5.9 strict·vitest4) + 패키지 7개 골격, core ForgeError/종료코드, mulberry32 PRNG, cli `forge --version`, 범용 툴로 방향 확정(데모 조사 삭제, 예시 바이블 `sample-v0`, `roleColorKey`, P5는 엔진 무관 `dir` 어댑터)
  - 수락기준: install·build·test 통과(8파일 13테스트), `forge --version` 한 줄 JSON, sample-v0 바이블 존재 — 전부 통과
  - 다음: P1(래스터·색·도형·PNG 입출력)
