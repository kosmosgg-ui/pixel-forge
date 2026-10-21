import { srgbToOklab } from '@pixel-forge/core';
import { check, worstFrame, type Check, type QaContext, type QaFrame } from '../types.js';


/** read.contrast: 실루엣(불투명 픽셀) 평균 명도와 바이블 배경 명도의 차 ≥ contrastMinL (OKLab L) */
export function readContrast(frames: readonly QaFrame[], ctx: QaContext): Check {
  const bg = srgbToOklab(...ctx.background).L;
  // 팔레트 인덱스별 L을 한 번만 계산 (픽셀 루프에서 객체를 만들지 않는다)
  const L = Float64Array.from(ctx.palette.colors, (c) => srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255).L);
  let sum = 0, n = 0;
  for (const { raster: r } of frames) for (const v of r.px) {
    if (v && v < L.length) { sum += L[v] ?? 0; n++; }
  }
  const diff = n ? Math.abs(sum / n - bg) : 0;
  return check('read.contrast', false, diff >= ctx.rules.contrastMinL, round(diff), ctx.rules.contrastMinL);
}

/** read.role-color: roleColorKey 재질 픽셀이 불투명 픽셀의 roleColorMin 이상 */
export function readRoleColor(frames: readonly QaFrame[], ctx: QaContext): Check {
  const min = ctx.rules.roleColorMin;
  if (!ctx.roleIndices) return check('read.role-color', false, true, null, min, { note: 'role 없음' });
  let role = 0, all = 0;
  for (const { raster: r } of frames) for (const v of r.px) if (v) { all++; if (ctx.roleIndices.has(v)) role++; }
  const ratio = all ? role / all : 0;
  return check('read.role-color', false, ratio >= min, round(ratio), min);
}

/**
 * form.face-clear: 프레임마다(공격 프레임 포함) 판정해 가장 나쁜 프레임으로.
 * - 머리 뼈 파츠 면적 중 다른 뼈 파츠에 가려진 비율 ≤ faceCoverMax
 * - 머리 위에 손에 든 파츠 픽셀 0 (무기가 머리 실루엣을 끊지 않게)
 * - 눈 둘레 창(최소 3×2)이 전부 얼굴 재질 — 같은 뼈의 투구·두건 등 다른 재질로 덮여도 가림
 */
export function formFaceClear(frames: readonly QaFrame[], ctx: QaContext): Check {
  const max = ctx.rules.faceCoverMax;
  let worst = -1, any = false, fail = -1, note = '';
  frames.forEach((f, i) => {
    const face = f.face;
    if (!face?.area) return;
    any = true;
    const ratio = face.covered / face.area;
    worst = Math.max(worst, ratio);
    if (fail >= 0) return;
    const why = ratio > max ? `가림 ${round(ratio)}` : face.heldOver ? `머리 위 무기 ${face.heldOver}px` : face.eyeWindowBad ? `눈 둘레 얼굴 아닌 픽셀 ${face.eyeWindowBad}/${face.eyeWindow ?? 0}` : '';
    if (why) { fail = i; note = `${f.name} ${why}`; }
  });
  if (!any) return check('form.face-clear', false, true, null, max, { note: 'eyes(머리 뼈) 없음' });
  return check('form.face-clear', false, fail < 0, round(worst), max, fail >= 0 ? { frame: fail, note } : {});
}

/** form.detail-min: 같은 재질 8-연결 영역(1px 대각선 획도 한 조각) 중 detailMinPx 미만 조각 수 ≤ detailMaxCount (mark 위치 제외) */
export function formDetailMin(frames: readonly QaFrame[], ctx: QaContext): Check {
  const { detailMinPx, detailMaxCount } = ctx.rules;
  const perFrame = frames.map(({ raster: r, material, mark }) => {
    const where: [number, number][] = [];
    if (!material) return where;
    const seen = new Uint8Array(material.length);
    for (let k = 0; k < material.length; k++) {
      if (!material[k] || mark?.[k] || seen[k]) continue;
      const m = material[k];
      const stack = [k];
      seen[k] = 1;
      let size = 0;
      while (stack.length) {
        const j = stack.pop() ?? 0, x = j % r.w, y = (j - x) / r.w;
        size++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, n = Y * r.w + X;
          if (X >= 0 && Y >= 0 && X < r.w && Y < r.h && !seen[n] && !mark?.[n] && material[n] === m) { seen[n] = 1; stack.push(n); }
        }
      }
      if (size < detailMinPx) where.push([k % r.w, Math.floor(k / r.w)]);
    }
    return where;
  });
  // 임계값은 프레임 1장 기준이라 가장 나쁜 프레임으로 판정
  const w = worstFrame(perFrame);
  return check('form.detail-min', false, w.value <= detailMaxCount, w.value, detailMaxCount, w.extra);
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
