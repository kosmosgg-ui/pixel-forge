import { alphaBinary, boundsCanvas, colorBudget, paletteConformance } from './checks/integrity.js';
import { cleanupBanding, cleanupOrphans } from './checks/cleanup.js';
import { formDetailMin, formFaceClear, formHeadClearance, formSignature, readContrast, readRoleColor } from './checks/readability.js';
import { animFlicker, animPoseDistinct, baselineStable } from './checks/anim.js';
import { formHeldVisible } from './checks/held.js';
import type { Check, QaContext, QaFrame, Report } from './types.js';

/** 단일 캐릭터 검사 전부 → 리포트. 필수 검사 하나라도 실패하면 불합격, 점수 = 통과 비율 */
export function runChecks(frames: readonly QaFrame[], ctx: QaContext, extra: readonly Check[] = []): Report {
  const checks: Check[] = [
    paletteConformance(frames, ctx), alphaBinary(frames, ctx), colorBudget(frames, ctx), boundsCanvas(frames),
    baselineStable(frames), animFlicker(frames, ctx), animPoseDistinct(frames, ctx), formHeldVisible(frames, ctx),
    cleanupOrphans(frames, ctx), cleanupBanding(frames, ctx),
    readContrast(frames, ctx), readRoleColor(frames, ctx), formFaceClear(frames, ctx), formHeadClearance(frames), formSignature(frames, ctx), formDetailMin(frames, ctx),
    ...extra,
  ];
  return summarize(ctx.id, checks);
}

export function summarize(id: string, checks: Check[]): Report {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).map((c) => c.id);
  return {
    id,
    pass: checks.every((c) => c.pass || !c.required),
    score: Math.round((passed / checks.length) * 100) / 100,
    checks,
    sheet: { legend: failed.length ? `빨간 테두리 = 실패 위치: ${failed.join(', ')}` : '실패 없음' },
  };
}
