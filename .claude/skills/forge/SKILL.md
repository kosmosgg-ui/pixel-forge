---
name: forge
description: 캐릭터·몬스터 스프라이트를 한 문장 지시나 기획서로 만들고 고치고 게임에 적용한다. "○○ 캐릭터 만들어줘/적용해줘", "몬스터 스프라이트 추가", "△△ Spec 수정" 같은 요청에 사용. Spec(JSON)만 쓰고 build → QA → apply까지 수행한다.
---

한 캐릭터를 0에서 apply까지 만든다. 클로드는 **Spec JSON만** 쓴다. 픽셀·렌더러·규칙은 손대지 않는다.

**순서 고정**: build → (QA 필수 통과) → pixel-reviewer 18/24 이상(`out/<id>/review.json`) → apply. 순서를 바꾸지 않는다. `forge apply`는 검수 기록을 확인하고, 없거나 미달이면 exit 2로 복사하지 않는다(`--skip-review`는 사용자가 지시했을 때만).

## 0. 준비 (캐릭터마다 1회)
- 시작 시각: `date +%s`를 적어 둔다(보고의 소요 시간).
- 요청이나 기획서에서 **그 캐릭터 부분만** 읽는다: 역할(아군·적), 무기·소품, 성격·인상, 크기, 필요한 애니.
- 대상 프로젝트는 지시가 없으면 `sample`, 바이블은 그 프로젝트 Spec들이 쓰는 것.
- 바이블은 `node -e`로 필요한 키만 본다: `sizeClasses`, `colorBudget`, `materials` 이름, `roleColorKey`.

## 1. 크기·재질 결정 (멈춤 지점 2곳)
- sizeClass: 아군·인간형 = `character`(48×48, 15색). 작은 적 = `smallMonster`(32×32, 7색). 지시에 크기가 있으면 그것.
  - 큰 무기·큰 몸집이 캔버스를 넘으면 엔진이 자동으로 다음 등급(예: `large` 64×64, 20색)으로 올린다(build JSON `sizeClass.used`). 등급을 고정해야 하면 Spec에 `"sizeClassLock": true`.
- 재질은 **바이블에 있는 것만**. 표현에 꼭 필요한 재질(예: 뼈, 녹슨 금속)이 없으면:
  1. `docs/proposals/bible-<내용>.md`에 제안서(재질 이름·base 색·steps·쓰는 캐릭터·이유)를 쓰고
  2. **그 캐릭터는 멈추고** 사용자 승인을 요청한다(사람 승인 지점). 바이블을 직접 고치지 않는다.
  3. 비슷한 기존 재질로 대체할 수 있으면 대체안도 제안서에 한 줄로 적는다.
- `role`은 `roleColorKey`에 있는 키만. 맞는 역할이 없으면 role을 생략한다(키 추가는 바이블 변경 = 제안만).
- 리그에 없는 동작(활 쏘기, 시전 등)은 새 애니를 만들지 않고 `attack`을 재사용, `docs/backlog.md`에 한 줄 기록.

## 2. Spec 작성
0. **모드**(사용자 승인 P6.5): 리그로 움직이는 생물 = `atoms`(시안 그리드가 있으면 pixel-studio 스킬로 아톰 분할), 아이템·이펙트·리그 없는 생물 = `frames`, `shapes` = 시안·자리표시용(시안이 없을 때의 초안).
1. 같은 sizeClass의 기존 Spec 1개를 템플릿으로 복사한다: `data/specs/<project>/*.spec.json`. 같은 sizeClass가 없으면 가장 비슷한 체형의 Spec.
2. 새 파일 `data/specs/<project>/<id>.spec.json`(id는 `^[a-z0-9][a-z0-9_-]*$`)에서 고친다:
   - `id`, `sizeClass`, `role`, `parts`, `eyes`, `overrides`(필요한 키만).
   - smallMonster는 `proportions.height`를 20 안팎으로(리그 키 30 기준 축척), 파츠 크기도 함께 줄인다.
3. 형태 지침 (ARCHITECTURE §7.2):
   - 실루엣이 역할을 말하게: 큰 형태 1개(방패·망토·큰 무기·모자)로 차이를 만든다. 기존 캐릭터와 실루엣이 겹치면(form.silhouette) 큰 형태를 바꾼다.
   - 재질 3~4개(smallMonster는 2~3개). 역할색 재질이 실루엣의 20% 이상.
   - 손에 든 무기·소품은 `"held": true`, 두께 2px 이상. 1px 장식은 `"decorative": true`(held 아님).
   - 무기 조각(날·날밑·손잡이)은 `weapon` 뼈에 같은 축으로, `orient: "world"`, `anchor: "joint"`. 손잡이가 손을 지나가게.
   - 눈: `eyes.pos`를 얼굴 재질 위에. 눈 둘레 3×2가 얼굴 재질이어야 한다(투구·두건이 덮지 않게).
   - **smallMonster는 축소한 사람이 아니라 별도 설계**: 기본 리그 `humanoid-small-v1`(키 20, 머리 45%, 짧은 팔다리, 손 2×2 — Spec에 `rig`를 쓰지 않으면 크기 등급 기본 리그). 외곽선은 등급 설정의 단색(dark), 색 예산 9(외곽선 1색 포함).
     - Spec `"signature": "<특징 하나>"`(예: ears, skull)를 적고 그 파츠에 `"signature": true`. 면적은 15~40% 밖일 때만 경고(QA `form.signature`, 선택). 수치 기준을 맞추려고 디자인을 과장하지 않는다 — 시안·레퍼런스와의 비교가 우선, 특징 판정은 pixel-reviewer "역할 원형 판독".
     - 얼굴·특징처럼 형태가 중요한 파츠는 mask 파츠(§7.3)를 먼저 쓴다. dark 외곽선 등급에서는 mask 안의 1px 빈칸(눈구멍·이빨 틈·갈비 틈)이 외곽선색(검정)으로 채워진다.
     - dark 등급에서 1px 획(뼈 팔다리 등)은 재질색 그대로 양옆에 외곽선이 붙는다. 1px held는 안 되고 `decorative: true`만.
4. `pnpm -s forge validate <spec>`로 스키마부터 확인.

## 3. 빌드·QA 루프 (최대 3회)
1. `pnpm -s forge build <spec>` → 한 줄 JSON 확인(`pass`, `failed`).
2. 실패하면 `out/<id>/qa.json`에서 **실패 항목만** 본다:
   `node -e "const r=require('./out/<id>/qa.json');for(const c of r.checks.filter(c=>!c.pass))console.log(c.id,c.required,c.value,c.threshold,c.frame,c.note||'',JSON.stringify(c.where||[]).slice(0,80))"`
3. 고칠 곳 찾기(필수 실패부터):
   | 실패 | 흔한 원인 → Spec 수정 |
   | --- | --- |
   | `spec.held-too-thin` | held 파츠 두께 1px → `h`/`w` 2 이상 |
   | `bounds.canvas` | 무기·망토가 캔버스 끝에 닿음 → 길이 줄이기, 또는 `overrides.<anim>.<key>.pose.weapon.rot` |
   | `form.held-visible` | 무기가 손에서 떨어짐·가려짐 → `at`을 손 쪽으로, 손잡이 추가 |
   | `color.budget` | 재질·steps 과다 → 재질 합치기 |
   | `form.face-clear` | 눈 둘레가 투구·두건·팔에 덮임 → 머리 파츠 아래 경계 올리기, `eyes.pos` |
   | `form.silhouette` | 다른 캐릭터와 실루엣 IoU 과다 → 큰 형태 추가·변경 |
   | `read.role-color` | 역할색 면적 부족 → 망토·휘장을 역할색 재질로 |
4. 시각 판단이 필요할 때만 `out/<id>/sheet.png` **1장** Read(반복 1회당 최대 1장). 개별 프레임 PNG는 열지 않는다.
5. 3회 고쳐도 불합격이면 **중단**: 실패 항목·값·원인 가설 3줄을 보고하고 사용자 결정을 기다린다.
6. 선택 검사(`required: false`) 실패는 통과를 막지 않는다. 값만 보고에 적는다.

## 4. 교차 검사·적용
1. `pnpm -s forge build-all <project>` → 이 캐릭터가 `failed`에 필수 항목으로 없는지(교차 검사: 실루엣·스케일).
2. 시각 검수: `pnpm -s forge render <spec> --sheet 4`(→ `out/<id>/studio.png`) 후 `pixel-reviewer` 서브에이전트에 그 시트 검수 요청(관찰 먼저, 점수 /24, 합격 18). 리뷰어가 `forge review-score --obs`로 `out/<id>/review.json`(점수·기준별 관찰·sheetHash)을 남긴다. 미달이면 상위 제안 반영 후 3단계로(반복 횟수에 포함).
3. 적용(검수 합격 뒤에만): `pnpm -s forge apply <spec> --target dir --out <dir|@이름>`.
   - `--out`은 작업 폴더 안 상대 경로, 또는 `.forge/targets.local.json` 허용 목록의 `@이름`. 이 파일은 사람이 쓴다(클로드가 만들지 않는다).
   - 지시에 대상이 없으면 `out/apply-test`.

## 금지
- 픽셀 직접 편집, PNG 손질, 렌더러·QA 코드 수정.
- rules 수치·바이블 변경(제안서만), 새 애니 추가(attack 재사용 + backlog).
- 상용 게임 스프라이트를 저장소에 넣기(레퍼런스는 `forge ref analyze`의 측정값만).

## 기록·보고
- `docs/progress.md` 현재 단계 아래에 캐릭터당 한 줄: `<id> | 반복 n | QA pass(선택 실패 …) | reviewer x/24 | <분>분`.
- 사용자 보고(4줄):
  ```
  캐릭터: <id> (<sizeClass>)
  점수: QA <pass/fail> · reviewer <x>/24
  반복: <n>회 · <분>분
  적용: <apply 경로>
  ```
