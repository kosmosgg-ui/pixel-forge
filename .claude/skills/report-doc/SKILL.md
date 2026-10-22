---
name: report-doc
description: Phase 완료 시 「pixel-forge 작업 보고」 Claude Docs 문서를 갱신하는 형식. /phase-done 6단계에서 사용. 단계 중간에는 사용하지 않는다.
---

Phase(단계) 완료 시에만 「pixel-forge 작업 보고」 문서(https://claude.ai/artifact/ST1vmzv6Vx15CRwXBXbS38)를 갱신한다. 단계 중간에는 문서를 건드리지 않는다.

1. 문서를 읽을 때는 마지막으로 본 rev 이후 바뀐 부분만(`sinceRev`) 확인한다.
2. **진행 현황 표**: 상태 칸만 수정한다(완료한 단계 → 완료, 다음 단계 → 다음). 다른 칸·문구는 건드리지 않는다.
3. **결과 섹션**: 진행 현황 표 바로 아래(최신이 위)에 `## P{n} 결과 — <요약>` 섹션을 추가한다.
   - 15줄 이내, 표는 최대 1개
   - 첫 문장 = 결과(수락 기준 통과 여부 + 테스트 수)
   - art-judge 등급 한 줄(보정 세트 v2, 렌더 결과가 있는 단계)과 검수 시트 경로 `out/<project>/review.png`(`forge review <project>`로 생성)
   - "확인 필요" 항목(사용자 결정이 필요한 것)
   - 커밋 링크(`https://github.com/kosmosgg-ui/pixel-forge/commit/<sha>`)
4. 사용자에게 문서 링크를 준다.
