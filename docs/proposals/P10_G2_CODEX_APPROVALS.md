# P10 / G2 — Codex 인계 후 사용자 승인 기록

상태: **6건 사용자 결정 완료 / 실행 반영·검증 완료(2026-10-23)**. 구현 연결·제한은 [APPROVED_IMPLEMENTATION](../integrated/G2/APPROVED_IMPLEMENTATION.md) 참고. 출처: 이번 대화의 6개 질문에 대한 사용자 직접 응답. 인계 파일 main 제출 승인과 별도로 기록한다.

| 항목 | 사용자 응답 | 적용 계약 |
|---|---|---|
| fxPalette | 제안 팔레트 승인 | 아래 13개 키를 바이블에 반영하고 이펙트가 읽도록 연결. 기존 적 예고색·전투 판정 불변 |
| 세라 colorBudget | 세라 32색 유지 | hero=32 유지. 적 24색 유지. 24색 전환안 미채택 |
| metal_blade | 제안 기준 승인 | base=#c8d4dc, steps=3, kind=metal. 무기 가독성 검사 기준 |
| cellGrow | 확대 셀 규격 승인 | 세라112×80, 고블린96×48, 늑대112×48, 오크128×64, 오크 대장176×96. 그림 크기·배율·기존 후보 발 앵커 유지. 정식 경로 승격·Gate C는 별도 |
| PRO-01 | 피난민 마차 승인 | 현재 고정 방어 대상의 정체. 이동 호위 추가 없음. CH1-02 성문 유지. HP·공세·히트박스·저장 불변 |
| 직업 의상 | GDD 실루엣으로 후보 제작 승인 | GUARD=중갑·큰 방패·장검, SWIFT=경갑·짧은 옷자락·민첩한 검, RUNE=마법 직물·경갑·룬 장검. 공통 얼굴·체형 유지. 쌍검 필수 아님. 직업별 최종 디자인·미술·출시 승인은 별도 |

```json
{
  "k": "#141824", "w": "#ffffff", "v": "#f4f0dc",
  "c": "#7ff0e6", "C": "#2fb8b0", "n": "#1d6f78",
  "y": "#ffe27a", "j": "#e0a83a", "J": "#9a6420",
  "g": "#b8b3a8", "G": "#7d786e", "m": "#9fe0ff", "M": "#3f7fd0"
}
```

## 승인 기록 당시 반영 수준(아래는 과거 이력)

- 이번 제출은 승인 기록·DECISIONS 연결·progress 갱신만 한다. 바이블 JSON·rules·TS·pxl 소스·게임 코드·후보 PNG는 아직 변경하지 않았다. 승인과 구현 완료를 구분한다.
- pnpm 설치는 셸 프록시 소켓 EPERM, 온라인 META_FETCH_FAIL, 오프라인 NO_OFFLINE_META로 실패했다. build/test는 tsc/vitest가 없어 exit 1이다. 전체 Tests N passed 근거가 없으며 환경 검증 완료로 처리하지 않는다.
- 환경 복구 후: `pnpm install && pnpm build && pnpm test` → 바이블 `$history` 보존하여 fxPalette·metal_blade 반영/hero32 유지 → 이펙트 읽기·팔레트 검증 연결 → 승인 셀 계약 동기화와 관련 검사 → 마차·직업 프롬프트/설계 반영. 단계별 규칙 검사와 관련 테스트를 수행한다.
- G1 정식 경로 승격·기존 PR 병합·전투 수치 변경·신규 view/kind는 승인하지 않았다. ART_HOLD / 사용자 Gate C PENDING 유지.
- 그림은 사용자가 ChatGPT에서 제작해 전달한다. 이번 후보 제작 승인은 Codex 이미지 생성 API 호출 승인이 아니다.
