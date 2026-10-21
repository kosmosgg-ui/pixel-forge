---
name: external-tools
description: Aseprite·ImageMagick·Lospec 같은 외부 도구를 쓰려 할 때 확인하는 원칙. docs/tooling.md와 함께 본다.
---

- 외부 도구는 전부 **선택 기능**이다. `docs/tooling.md`에 "사용 가능"으로 적힌 것만 쓰고, 없으면 그 단계를 건너뛴다.
- 저장소 런타임 의존성에 추가하지 않는다(CLAUDE.md 의존성 허용 목록).
- 렌더 파이프라인 안에 외부 도구를 넣지 않는다. 쓰는 곳은 검증(예: Aseprite로 시트 JSON 열기)·사람의 후보정·스크래치 검토용 합성뿐이다.
- 도구가 새로 설치됐다고 하면 `/tool-scan`으로 tooling.md부터 갱신한다.
- 외부 형식(Aseprite JSON, PNG, 엔진 포맷)을 구현할 때는 공식 문서를 확인하고 근거 URL을 코드 주석에 단다.
