# progress

> 규칙: 단계당 10줄 이내. 최신이 위. 형식: `[P{n}] 상태 | 완료 | 수락기준 | 다음`

현재 단계: **P0**

## 로그
- [P0] 부분 완료 | 완료: 모노레포(pnpm·TS5.9 strict·vitest4) + 패키지 7개 골격, core ForgeError/종료코드, mulberry32 PRNG, cli `forge --version`
  - 수락기준: install·build·test 통과(8파일 13테스트), `forge --version` 한 줄 JSON 통과, `docs/demo-probe.md` 미작성(데모 저장소 미정)
  - 다음: 데모 저장소 경로 받으면 6~8단계(조사→demo-probe.md) 진행
  - 사용자 확인 필요: ① 「내려가자 던전」 데모 저장소 위치 ② 내부 해상도(현재 320×180 가정) ③ 캐릭터 캔버스(48×48 가정) ④ 직업 6종 목록
