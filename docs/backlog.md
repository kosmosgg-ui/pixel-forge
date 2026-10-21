# backlog (범위 밖 아이디어 — 한 줄씩)

- [후순위] 노멀맵 조명 출력 (§5 법선 버퍼 재사용) — Sea of Stars·Dead Cells식 동적 조명
- [후보] 레퍼런스 패턴 학습 → 비율·램프 프리셋 자동 생성
- [보류] Godot SpriteFrames .tres 익스포터 — 사용자 지시 전 금지
- [확장] view: topdown 4/8방향, iso
- [확장] kind: fx (item은 P7, tile은 P9, ui는 P10)
- [확장] 리그: quadruped, blob, winged
- [우선] 팔레트 고정 모드: forge palette import lospec <slug> → data/palettes/<slug>.json(출처·라이선스 포함), 바이블 paletteLock 지정 시 램프 색을 그 팔레트의 최근접 색(OKLab)으로 스냅
- [선택] Aseprite 연동: tooling.md에 사용 가능일 때만 P5 수락 기준에 Aseprite로 시트 JSON 열기 검증 추가
- [P3 리뷰] build-all이 qa.json에 더한 교차 검사(form.silhouette·scale.consistency)는 캐시에 저장되지 않음: 단독 build 재실행 시 교차 검사 없는 qa.json이 복원됨 — 교차 검사 결과를 별도 키로 저장할지 결정 필요
- [후순위] 손질 레이어(덧칠 패치): 렌더 결과 위에 사람이 그린 픽셀 패치를 결정론적으로 덮는 레이어
- [P4 리뷰] form.outline-thin의 얇음 판정을 프레임마다 회전된 마스크로 함 — 같은 파츠가 프레임 사이에 얇음/아님이 바뀌면 외곽선이 달라질 수 있음(현재 샘플에선 미발생). rest 마스크 기준 1회 판정 검토
