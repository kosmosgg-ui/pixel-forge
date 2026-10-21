# references — 기준작 측정 목표

목표 체급: 스팀 출시, 성공한 인디(브로테이토, 뱀파이어 서바이버즈). 아래 값은 **측정 전 TODO**이며, 스크린샷 원본은 저장소에 넣지 않는다(CLAUDE.md 저작권 규칙). 측정한 숫자와 출처 URL·측정 방법만 적는다.

| 항목 | 브로테이토 | 뱀파이어 서바이버즈 | pixel-forge에서 쓰는 곳 | 측정 방법 |
| --- | --- | --- | --- | --- |
| 캐릭터 키(px, 1배) | TODO | TODO | 바이블 `sizeClasses.character`, `proportions.height` | 플레이 화면 캡처를 원본 해상도로 보고 머리~발 픽셀 수 |
| 캐릭터 키 / 화면 세로 비율 | TODO | TODO | 바이블 `internalResolution`과 캔버스 크기 결정 | 키 ÷ 내부 해상도 세로 |
| 일반 적 키(px) | TODO | TODO | `smallMonster` 등급 크기 | 같은 방법 |
| 보스 키(px) | TODO | TODO | `boss` 등급 크기 | 같은 방법 |
| 적 동시 출현 규모(마리) | TODO | TODO | `forge crowd --count` 기본값 | 후반 웨이브 화면의 적 수 세기(대략치) |
| 아이콘 크기(px) | TODO | TODO | P7 `icon16`/`icon32` 결정 | 상점·인벤토리 아이콘 bbox |
| 스프라이트당 색 수 | TODO | TODO | `colorBudget` 검증 | 대표 스프라이트 고유 색 수 |
| 외곽선 방식 | TODO | TODO | 바이블 `outline.mode` | 검정/셀아웃/없음 판정 |
| 애니메이션 방식 | TODO | TODO | P4 프레임 수·`motion` 힌트 기본값 | 프레임 애니 vs 절차(bob·squash) 관찰 |

- 출처: TODO (측정에 쓴 공식 스토어 페이지·트레일러 URL)
- 측정이 끝나면 P6 `forge ref analyze`로 같은 값을 JSON(`data/refs/*.ref.json`)으로 남긴다.
