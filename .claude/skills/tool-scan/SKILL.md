---
name: tool-scan
description: 이 PC에서 pixel-forge가 활용할 수 있는 외부 도구·MCP·플러그인을 조사해 docs/tooling.md를 갱신한다. 처음 설치 시, 그리고 사용자가 도구를 새로 설치했다고 할 때 사용.
---

조사만 하고 아무것도 설치하지 않는다. 결과는 `docs/tooling.md` 표 하나(20줄 이내)로 덮어쓴다.

1. 명령 존재 확인(버전 한 줄씩): `node`, `pnpm`, `git`, `aseprite`(또는 OS별 기본 설치 경로의 Aseprite 실행 파일), `magick`, `python3`, `jq`
2. Claude Code 확장: `claude mcp list`, `claude plugin list`(지원 시)로 연결된 MCP 서버·플러그인 이름만 수집
3. 아래 후보의 사용 가능 여부 판정:
   | 후보 | 판정 기준 | pixel-forge에서 쓰는 곳 |
   | --- | --- | --- |
   | Aseprite CLI | 실행 파일 존재 | P5 산출 JSON/PNG를 Aseprite로 열어 호환 검증, 사람이 손보는 후보정 |
   | pixel-plugin (Aseprite MCP) | 플러그인 설치됨 + Aseprite 존재 | 수작업 후보정 자동화. 렌더 파이프라인에는 넣지 않음 |
   | Lospec 팔레트 | `https://lospec.com/palette-list/<slug>.json` 1회 요청 성공 | 팔레트 고정 모드(backlog) 데이터 소스 |
   | Claude Docs 커넥터 | 작업 보고 문서 갱신 가능 | Phase 보고 |
   | ImageMagick | `magick` 존재 | 임시 검토 시트 합성(스크래치 전용, 저장소 코드에서 사용 금지) |
4. 표 열: `도구 | 상태(사용 가능/없음) | 버전 | 용도 | 비고`. 없음인 항목은 설치 방법을 한 줄 링크로만.
5. 저장소 런타임 의존성은 늘리지 않는다. 외부 도구는 모두 "있으면 쓰고 없으면 건너뛰는" 선택 기능이다.
