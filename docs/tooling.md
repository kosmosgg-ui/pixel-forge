# tooling (/tool-scan 결과)

조사 환경: Claude Code 클라우드 세션 컨테이너(2026-10-21). 로컬 PC에서 작업할 때는 `/tool-scan`을 다시 실행해 이 표를 덮어쓴다.

| 도구 | 상태 | 버전 | 용도 | 비고 |
| --- | --- | --- | --- | --- |
| node | 사용 가능 | v22.22.0 | 빌드·CLI 실행 | |
| pnpm | 사용 가능 | 10.28.0 | 워크스페이스·스크립트 | |
| git | 사용 가능 | 2.43.0 | 커밋·이력 | |
| python3 | 사용 가능 | 3.13.16 | 스크래치 스크립트 | 저장소 코드에서 사용 안 함 |
| jq | 사용 가능 | 1.7 | JSON 확인 | 스크래치 전용 |
| ImageMagick | 사용 가능(6.x, `convert`) | 6.9.12-98 | 임시 검토 시트 합성 | `magick`(7.x) 명령은 없음. 저장소 코드에서 사용 금지 |
| Aseprite CLI | 없음 | - | P5 시트 JSON 호환 검증, 후보정 | [aseprite.org](https://www.aseprite.org/) |
| pixel-plugin (Aseprite MCP) | 없음 | - | 수작업 후보정 자동화 | Aseprite 필요. MCP 서버 0개, 플러그인 0개 |
| Lospec 팔레트 | 없음(네트워크 차단) | - | 팔레트 고정 모드(backlog) | lospec.com 연결이 이 환경의 네트워크 정책에 막힘 |
| Claude Docs 커넥터 | 사용 가능 | - | 「pixel-forge 작업 보고」 갱신 | |
