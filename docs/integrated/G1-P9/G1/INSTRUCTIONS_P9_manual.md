# 지시문 P9-M — 수동 GPT 생산 흐름 (사용자 결정 2026-10-22 21:15)

대상 저장소: kosmosgg-ui/pixel-forge. 선행: P8 완료.
**사용자 결정: API·Codex 연결은 보류. GPT 이미지는 사용자가 ChatGPT에서 직접 생성해 전달한다.**
INSTRUCTIONS_P9_gen.md(API 연결)는 이번에 구현하지 않는다 — backlog에 "P9-API: 설계 완료, 사용자 결정으로 보류(docs/integrated/G1/INSTRUCTIONS_P9_gen.md)" 한 줄. 아래 2절의 프롬프트 템플릿 구조는 나중에 API가 그대로 재사용하도록 같은 형식으로 만든다.

## 1. 흐름
```
forge prompts hero_sera          → 사용자용 요청 목록(무엇을, 어떤 참조를 붙여, 어떤 문구로, 어떤 파일명으로)
   ↓ 사용자가 ChatGPT에서 생성, 정해진 파일명으로 저장해 전달
forge intake <파일> --as hero_sera/walk_side   → 원본 등록 + 출처 기록
forge make hero_sera --action walk --dir side   → import(도트 변환·QA) → godot-rowsheet export(@seonggeom candidates)
   ↓ 불합격이면
클로드 코드가 "ChatGPT에 보낼 고치기 문구"를 사용자에게 제시 (API 호출 없음)
```

## 2. 프롬프트 = 데이터 (`data/projects/seonggeom/prompts/`)
- 사용자 문서 「세라 GPT 이미지 프롬프트 키트」 내용을 JSON 템플릿으로 옮긴다(사용자가 전달한 키트 텍스트 또는 아래 요약 기준):
  - `base.json`: 공통 스타일 — clean anime game illustration, bold clean dark lineart, flat cel shading 2–3 tones, no gradients/glow/texture, about 6 heads tall, **flat pure green #00FF00 background**(초록 캐릭터는 magenta #FF00FF), no text/numbers/labels/shadow/ground/effects, 40px 이상 여백, 같은 크기·같은 발 높이, 디자인 불변.
  - `actors/hero_sera.json`: 캐릭터 설명(갈색 하이 포니테일·파란 리본·갈색 눈·은색 판금+금 테두리·검은 장갑·흰/파랑 타바드+금 백합·파란 망토·장검), 참조 이미지 이름(`sera_ref.png`, `sera_turnaround.png`), 필요한 동작×방향 목록.
  - `actions/*.json`: idle 4 · walk 6 · attack 5 · hit 3 · dodge 3 · death 4 · ultimate 6 — 프레임별 포즈 문구(키트 표 그대로), 방향별 문구(side/front/back + 추가 문장), stride 등 메타.
  - `fixes.json`: 고치기 문구 8종(한 프레임 다른 캐릭터, 다리 안 움직임, 잘림, 크기 다름, 배경 체크무늬, 너무 세밀, 텍스트, 뒷면이 옆모습).
- 조립은 문자열 치환만. 조립 결과를 `out/prompts/<actorId>/<action>_<dir>.txt`로 저장.

## 3. `forge prompts <actorId>` — 사용자용 요청 목록
- 출력 1: `out/prompts/<actorId>/CHECKLIST.md` — 사람이 위에서부터 따라 하는 표:
  | 순서 | 저장 파일명 | 첨부할 참조 이미지 | 요청 문구 파일 | 상태 |
  - 순서는 키트의 생산 순서(턴어라운드 → side idle·walk → side attack·hit·dodge·death·ultimate → front·back idle·walk·attack·hit·dodge).
  - 파일명 규칙: `<actorId>__<action>_<dir>.png` (예: `hero_sera__walk_side.png`). 한글·공백 금지.
  - 상태 열은 intake가 자동 갱신(대기/등록/합격/재요청).
- 출력 2: 한 줄 요약 JSON(요청 수, 남은 수).
- 사용자에게는 CHECKLIST의 다음 3개 항목만 채팅으로 보여 준다(문구 전문 포함, 복사하기 쉽게 코드 블록). 한 번에 전부 쏟아내지 않는다.

## 4. `forge intake <file> --as <actorId>/<action>_<dir>`
- 입력 검사: PNG/JPEG/WebP, 긴 변 ≥ 1024px(작으면 경고 — 파일럿에서 키 210px 원본은 테두리가 거칠었음), 파일명 규칙(다르면 `--as`로 지정).
- 저장: `data/import/<actorId>/<action>_<dir>/<timestamp>.<ext>`(gitignore) + `.intake.json`:
  `{ origin: "chatgpt-manual", model: "ChatGPT 이미지 생성(사용자 실행, 모델명 미확인)", createdAt, promptFile, promptSha256, references: [...], receivedFrom: "user" }`
- provenance 매핑: `creator: "user via ChatGPT"`, `aiUsed: true`, `promptRecord: <promptFile>`, `rightsReviewed: false`, `license: "OpenAI 이용약관에 따른 사용자 생성물(사용자 확인 필요)"`.
- 같은 동작에 새 파일이 오면 이전 것을 지우지 않고 새 timestamp로 추가, make는 최신본 사용(`--pick <timestamp>`로 지정 가능).

## 5. `forge make` 불합격 처리 (API 없음)
- import QA·art-judge 결과에 따라 **고치기 문구를 고르고 채워서** 사용자에게 제시:
  - 프레임 수 불일치 → 요청 문구 재사용 + "exactly N frames"
  - `import.identity` 경고 프레임 k → fixes "한 프레임 다른 캐릭터"(frame k)
  - `import.clipped` → fixes "잘림"
  - `import.jitter` 큼 / 크기 다름 → fixes "크기 다름"
  - 배경 잔여 → fixes "배경"
  - art-judge 관찰에 "다리"·"보폭" → fixes "다리 안 움직임"
  - 뒷면 요청인데 얼굴 검출(눈 색 픽셀) → fixes "뒷면이 옆모습"
- 제시 형식: "ChatGPT의 같은 대화에서 아래 문구를 보내고, 결과를 `<같은 파일명>`으로 다시 주세요" + 코드 블록 1개. 같은 항목 2회 실패하면 "새 대화에서 처음부터"를 권하고, 3회면 사용자 판단 요청.
- 합격하면 CHECKLIST 상태 갱신 + candidates export + 다음 3개 항목 안내.

## 6. 파일 전달 경로 (사용자 ↔ 클로드 코드)
1. 기본: 사용자가 클로드 코드 채팅에 이미지를 첨부 → 클로드 코드가 첨부 파일 경로에서 intake.
2. 첨부가 안 보이면(과거 여러 번 발생): 사용자가 GitHub 웹에서 pixel-forge 저장소의 **`art-inbox` 브랜치** `inbox/` 폴더에 업로드 → 클로드 코드가 `git fetch origin art-inbox`로 가져와 intake. `art-inbox`는 **절대 main에 병합하지 않는다**(생성 원본이 저장소 이력에 들어가지 않게). intake 후 그 파일을 inbox에서 지우는 커밋은 사용자 요청 시에만.
- 첨부를 받지 못하면 추측하지 말고 "어느 파일을 못 받았는지"를 보고.

## 7. 수락
- `forge prompts hero_sera` → CHECKLIST 생성, 요청 수(턴어라운드 1 + 세라 동작 17 = 18 내외) 표시.
- 템플릿 조립 골든 테스트(문자열 SHA), 파일명 규칙 테스트, intake 메타 테스트(키·개인정보 없음).
- 파일럿 원본(docs/integrated/P8/samples/pilot/walk_right/ 6장을 하나의 스트립으로 합친 합성 입력 또는 원본 strip)을 `hero_sera__walk_side`로 intake → make → candidates export 성공(G1이 읽을 첫 후보).
- 불합격 시뮬레이션: 잘림·identity 합성 입력에서 올바른 고치기 문구가 선택되는지 테스트.

## 8. 하지 말 것
- 어떤 이미지 생성 API·Codex 호출도 하지 않는다.
- 생성 원본을 main에 커밋.
- 사용자에게 한 번에 18개 요청 전부 제시(피로) — 3개씩.
