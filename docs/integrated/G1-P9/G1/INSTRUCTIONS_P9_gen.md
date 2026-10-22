# 지시문 P9 — `forge gen`: GPT 이미지 API 연결 (사용자 승인 2026-10-22)

대상 저장소: kosmosgg-ui/pixel-forge. 선행: P8(import + godot-rowsheet export) 완료.
목표: 클로드 코드가 GPT 이미지 API를 직접 호출해 원본 일러스트를 만들고 → `forge import`로 도트 변환 → 게임 후보 폴더로 내보내는 한 줄 파이프라인.

## 0. 원칙
- **생성(gen)과 변환(import)은 분리한다.** import는 지금처럼 API를 모른다. gen은 원본 PNG와 기록만 남긴다. 그래야 같은 원본으로 변환을 몇 번이든 재현할 수 있다(결정론 유지).
- 새 패키지 `packages/gen`(I/O 패키지 — fs·network 허용, 순수 코어 규칙 대상 아님). cli가 gen → import 순서로 호출.
- **의존성 추가 금지**: OpenAI SDK를 쓰지 않고 Node 22 내장 `fetch` + `FormData`/JSON으로 호출. 응답 base64 → PNG 저장.
- 인증 방식 2가지(바이블/환경 설정 `gen.auth`):
  - `proxy`(**클라우드 클로드 코드 기본, 권장**): 사용자가 클라우드 환경의 **네트워크 시크릿**(Bearer, 허용 호스트 `api.openai.com`)으로 키를 등록한다. 에이전트 프록시가 요청이 VM을 떠난 뒤 `Authorization` 헤더를 붙이므로 키는 세션 안에 존재하지 않는다. 이 모드에서는 Authorization 헤더 없이 요청한다. 401이면 `gen.auth-missing`("네트워크 시크릿 등록 확인") 보고. 근거: https://code.claude.com/docs/en/cloud-environments#add-network-secrets
  - `env`(로컬 CLI용): 환경변수 `OPENAI_API_KEY`에서 읽는다.
- `env` 모드의 키도 환경변수에서만 읽는다. 로그·오류 메시지·manifest·커밋에 키(또는 앞 몇 글자)를 절대 남기지 않는다. 키가 없으면 `ForgeError("gen.no-key")` + "사용자에게 키 설정을 요청하라" 한 줄.
- 비용은 사용자 돈이다: 모든 호출 전에 예상 호출 수를 출력하고, 한 번 실행에 기본 상한 `--max-calls 6`. 상한을 넘기는 계획은 실행하지 말고 계획만 보고해 사용자 승인을 받는다. 누적 호출 수·추정 비용을 `.forge/gen-ledger.jsonl`(gitignore)에 기록.

## 1. API 사양 (2026-10-22 공식 문서 확인값 — 구현 전 다시 확인하고 근거 URL 주석)
- 문서: https://developers.openai.com/api/docs/guides/image-generation , https://developers.openai.com/api/reference/resources/images/methods/edit
- 엔드포인트: `POST https://api.openai.com/v1/images/generations`(참조 없음), `POST https://api.openai.com/v1/images/edits`(참조 이미지 있음 — 우리는 거의 항상 이것).
- 모델: 기본 `gpt-image-2.5-sunburst`(편집 정밀도 우선, 2026-09-08 스냅숏 존재). 빠른 초안은 `gpt-image-2.5-flare`. 바이블 설정 `gen.model`로 바꿀 수 있게. 재현성을 위해 manifest에는 **스냅숏 이름**(`…-2026-09-08`)을 기록.
- 참조 이미지: 편집 요청에 최대 16장. 우리는 기준 이미지 1장 + 턴어라운드 1장(+ 적은 주인공 기준 1장).
- `background`: `"transparent"` 지원(2.5 sunburst·flare). 단 **기본은 초록 크로마 배경**으로 요청하고(프롬프트 키트 규칙), `--transparent`는 실험 옵션. 투명 출력은 가장자리 반투명이 생기므로 import의 알파 이진화가 필수.
- `size`: 2.5 모델은 임의 `WxH`(각 16의 배수, 비율 1:3~3:1). 가로 스트립은 `2048x768`(6프레임) 같은 값을 쓴다 — 그림 하나가 커야 변환 품질이 좋다(파일럿에서 키 210px 원본은 테두리가 거칠었음).
- `quality`: 초안 `medium`, 확정 후보 `high`. `n`: 1(후보 비교가 필요할 때만 2).
- `output_format`: `png`.
- 조직 인증이 필요할 수 있음(문서 명시). 403 등 인증 오류는 재시도하지 말고 `gen.org-verification` 오류로 사용자에게 보고.
- 가격은 문서 가격표에서 읽어 `data/gen-pricing.json`에 날짜와 함께 수동 기록(코드에 하드코딩 금지). 확인 못 하면 "추정 불가"로 표시.

## 2. 프롬프트 = 데이터
- 프롬프트 키트(사용자 문서 「세라 GPT 이미지 프롬프트 키트」)를 `data/projects/seonggeom/prompts/`의 JSON 템플릿으로 옮긴다:
  - `base.json`: 공통 스타일 문단(애니 일러스트, 굵은 선, 셀 셰이딩 2~3단, 초록 배경, 텍스트 금지 등)
  - `actors/hero_sera.json`: 캐릭터 설명, 참조 이미지 경로, 동작 목록
  - `actions/*.json`: 동작별 프레임 수·프레임 포즈 목록(idle·walk·attack·hit·**dodge**·death·ultimate), 방향별 문구(front·side·back), 고치기 문구
- `forge gen` = 템플릿 조립(문자열 치환만) → 요청. 조립된 최종 프롬프트 전문을 원본 옆 `.prompt.txt`로 저장(스팀 AI 공개·재현용).
- dodge 포즈(키트에 없던 것 — 추가): `1. crouch and lean in the dodge direction 2. quick sidestep, body low, cape trailing 3. land and recover to ready stance`.

## 3. CLI
```
forge gen <actorId> --action walk --dir side [--quality medium] [--model …] [--max-calls 6] [--dry-run]
forge gen <actorId> --plan            # 필요한 동작×방향 목록과 예상 호출 수·비용만 출력
forge make <actorId> --action walk --dir side   # gen → import → godot-rowsheet export(@seonggeom candidates) 한 번에
```
- 원본 저장: `data/import/<actorId>/<action>_<dir>/<timestamp>.png` + `.prompt.txt` + `.request.json`(키 제외, 모델·크기·품질·참조 이미지 해시).
- `--dry-run`: 요청 본문만 출력, 호출 안 함. 테스트는 전부 dry-run + 가짜 fetch 주입으로(실제 호출 테스트 금지).

## 4. 자가 검수 루프 (클로드 코드가 결과를 보고 다시 뽑을지 결정)
1. gen → import 직후 import QA 경고(`clipped`, `identity`, `jitter`, 프레임 수 불일치, 배경 잔여)를 확인.
2. art-judge에 결과 시트 1장으로 v2 등급 판정.
3. 다음이면 **고치기 요청**(키트의 고치기 문구 템플릿, 원본을 참조로 첨부한 edits 호출) 1회: 프레임 수 불일치, 잘림, 한 프레임만 다른 캐릭터, 다리 안 움직임, 뒷면인데 얼굴 보임.
4. 고친 뒤에도 실패면 **새로 생성** 1회. 그래도 실패면 멈추고 사용자에게 시트·경고 보고. 한 동작당 API 호출 최대 3회.
5. 통과(QA 필수 통과 + art-judge `B–A` 이상)한 것만 candidates로 export.

## 5. 키·네트워크 환경
- 로컬 CLI에서 실행: 사용자가 OS 환경변수 또는 저장소 밖 파일로 키를 설정. 저장소의 `.env*`는 .gitignore 확인(없으면 추가).
- 클라우드(웹) 클로드 코드에서 실행: `proxy` 모드. 키는 네트워크 시크릿으로만(환경변수에 넣지 않는다 — 환경변수는 환경 사용자 누구나 읽을 수 있음). 시크릿의 허용 호스트에 들어간 도메인은 네트워크 접근 수준과 무관하게 열린다. 그래도 403(프록시 차단)이면 `gen.network-blocked`로 보고(우회 금지).
- 키가 채팅에 붙여넣어지면 사용하지 말고 "키를 폐기하고 환경변수로 다시 설정해 달라"고 요청.

## 6. 수락
- `forge gen hero_sera --plan` → 세라 전체 계획 표(동작×방향, 호출 수 17 ± α, 추정 비용).
- dry-run 테스트: 템플릿 조립 골든(문자열 SHA), 키 미노출(로그 스냅숏에 `sk-` 없음), 상한 초과 시 실행 거부.
- **실제 호출 1회(사용자 키 설정 후, 사용자에게 "1회 시험 호출" 승인 받고)**: 세라 walk·front 1장 → import → candidates. 시트 + QA + art-judge 등급 보고.
- `.forge/gen-ledger.jsonl`에 호출 1건 기록, 키 미포함.

## 7. 하지 말 것
- 키를 코드·설정·커밋·로그에 기록, 키를 채팅으로 요청.
- 사용자 승인 없이 상한 초과 호출, 반복 재시도 루프.
- 생성 원본·결과 PNG 커밋(data/import는 gitignore).
- 프롬프트를 코드에 하드코딩.
