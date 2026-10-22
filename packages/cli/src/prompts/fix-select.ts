import type { FixId } from '@pixel-forge/spec';

/** make 결과 요약(고치기 문구 고르기 입력) */
export interface MakeFindings {
  /** 원본에서 찾은 스프라이트 수 vs 동작 프레임 수 */
  sprites: number;
  frames: number;
  /** 불합격 import 검사: id + note */
  failed: readonly { id: string; note?: string }[];
  /** 원본 배경이 단색(초록·마젠타·흰색)으로 지워졌는가 */
  backgroundOk: boolean;
  /** art-judge 관찰(--judge) */
  judge?: string;
  view: string;
}

export interface FixChoice {
  ids: FixId[];
  frameCount: boolean;
  /** identity 경고 프레임(1부터) */
  frame?: number;
}

/**
 * 고치기 문구 고르기(P9-M 5): 프레임 수 → 문구 재사용 + "exactly N", identity → 그 프레임, clipped → 잘림,
 * jitter → 크기 다름, 배경 잔여 → 배경, 판정 관찰 "다리"·"보폭" → 다리 안 움직임, 뒷면인데 "얼굴" → 뒷면이 옆모습.
 */
export function selectFixes(f: MakeFindings): FixChoice {
  const ids: FixId[] = [];
  const has = (id: string) => f.failed.find((c) => c.id === id);
  let frame: number | undefined;
  const identity = has('import.identity');
  if (identity) {
    ids.push('identity');
    // note "…: walk_e_3" — 프레임 번호는 0부터 → 사람용 1부터
    const m = /_(\d+)(?:,|$)/.exec(identity.note ?? '');
    if (m?.[1]) frame = Number(m[1]) + 1;
  }
  if (has('import.clipped')) ids.push('clipped');
  if (has('import.jitter') || has('import.oversize')) ids.push('size');
  if (!f.backgroundOk) ids.push('background');
  if (f.judge && /다리|보폭/.test(f.judge)) ids.push('legs');
  if (f.view === 'back' && f.judge && /얼굴|옆모습/.test(f.judge)) ids.push('backface');
  return { ids, frameCount: f.sprites !== f.frames, ...(frame !== undefined ? { frame } : {}) };
}

/** 같은 항목 실패 횟수별 안내(P9-M 5) */
export function retryAdvice(fails: number, file: string): string {
  if (fails >= 3) return `같은 항목이 ${fails}회 불합격 — 계속할지·요청을 바꿀지 사용자 판단이 필요합니다.`;
  if (fails === 2) return `2회 불합격 — ChatGPT에서 새 대화를 열고 처음 요청 문구부터 다시 보낸 뒤, 결과를 \`${file}\`로 주세요.`;
  return `ChatGPT의 같은 대화에서 아래 문구를 보내고, 결과를 \`${file}\`로 다시 주세요.`;
}
