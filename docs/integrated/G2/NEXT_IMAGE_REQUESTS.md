# 다음 세라 이미지 요청 — 정면/뒷면 대기, 정면 걷기

기존 옆 방향 후보는 변환 완료다. 현재 data/import/state.json이 복원되지 않아 `forge prompts`의 remaining=18/next는 이미 받은 항목까지 포함한다. 실제 제작 잔여 여부는 seonggeom 후보 매니페스트·G2_CONVERTED_ASSET_STATUS.md와 함께 판단하며 기존 항목을 중복 요청하지 않는다.

## 이번 요청 3건

| 순서 | 요청 문구(생성 후) | 결과 원본 저장 파일명 | 구성 |
|---|---|---|---|
| 1 | out/prompts/hero_sera/idle_front.txt | hero_sera__idle_front.png | 정면 대기 4프레임 / 한 줄 |
| 2 | out/prompts/hero_sera/idle_back.txt | hero_sera__idle_back.png | 뒷면 대기 4프레임 / 한 줄 / 얼굴 비노출 |
| 3 | out/prompts/hero_sera/walk_front.txt | hero_sera__walk_front.png | 정면 걷기 6프레임 / 한 줄 |

각 요청마다 **hero_sera__ref.png, hero_sera__turnaround.png, hero_sera__size_ref.png** 3장을 첨부한다. 확정 기준 원화·3방향 참조·서 있는 크기 참조이며, 이 환경에는 원본이 복원되지 않았다. 기존 보유 원본을 사용한다. 세라의 망토 없음·갈색 눈·높은 포니테일/파란 리본·은색/금색 갑옷·흰색/파란색 문양·동일 얼굴/키/머리 크기를 유지한다.

ChatGPT에서 한 번에 한 요청씩, txt 전체를 사용한다. 순수 초록 #00FF00 배경, 3/4 탑뷰(약30도), 잘리지 않은 전신·프레임 사이 여백·같은 발 기준선. 검기/발광/그림자/글자 없이 캐릭터만. 결과는 원본 PNG로 저장해 전달한다. 생성 API는 호출하지 않는다.

이어서 뒷면 걷기6프레임을 요청한다. 그 이후 컷인·마차·직업 후보를 순차 제작한다. 새 이미지를 받으면 intake → make → 후보 시트 → 미술 검수로 진행한다. 정식 교체/PR 병합은 별도 승인이다.

## 문구 수정 및 검증

공용 idle의 `cape slightly moved`를 호흡 복귀 동작으로, walk 뒷면의 `show ... cape`를 뒤통수·포니테일·타바드/망토 없음/얼굴 비노출로 수정했다. 확정 정사를 바꾼 것이 아니라 기존 정사와 모순되는 잔재를 제거했다. 일반 템플릿 구조·프레임 수·게임 수치 변경 없음.

실행: /workspace/pixel-forge에서 기존 Node22.23.4/pnpm10.28.0 활성화 후 `pnpm forge prompts hero_sera`. 실제 세라 전후면 idle/walk 조립 문구에 망토 잔재가 없는지 검사하고 변경된 idle_back 문자열 골든만 의도적으로 갱신했다. `pnpm build && pnpm test` = Tests294 passed /2 skipped(원본2장 부재). `node scripts/check-rules.mjs` 통과.

이번 생성 묶음: out/prompts/hero_sera/sera-next-three-requests.zip. 문구3개와 사용방법 포함, 참조 이미지 자체는 미포함. ZIP과 생성 txt/PNG는 Git 커밋 대상이 아니다.
