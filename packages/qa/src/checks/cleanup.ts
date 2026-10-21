import { check, type Check, type QaContext, type QaFrame } from '../types.js';

/** 8-이웃에 같은 색이 없는 픽셀 수 ≤ orphanMax (외곽선·눈 등 mark 위치 제외) */
export function cleanupOrphans(frames: readonly QaFrame[], ctx: QaContext): Check {
  const where: [number, number][] = [];
  for (const { raster: r, mark } of frames) {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const k = y * r.w + x, v = r.px[k] ?? 0;
      if (!v || mark?.[k]) continue;
      let same = false;
      for (let dy = -1; dy <= 1 && !same; dy++) for (let dx = -1; dx <= 1 && !same; dx++) {
        const X = x + dx, Y = y + dy;
        if ((dx || dy) && X >= 0 && Y >= 0 && X < r.w && Y < r.h && r.px[Y * r.w + X] === v) same = true;
      }
      if (!same) where.push([x, y]);
    }
  }
  return check('cleanup.orphans', false, where.length <= ctx.rules.orphanMax, where.length, ctx.rules.orphanMax, where.length ? { where } : {});
}

/**
 * 밴딩: 같은 램프의 세 단계가 1px 폭 띠로 나란히 놓인 곳(A|B|C, 단계가 한 방향으로 증가 또는 감소).
 * 가로·세로로 찾은 띠 픽셀을 8-연결로 묶고, 2px 이상 이어진 것(계단처럼 나란히 달리는 선)만 구간으로 센다. 구간 수 ≤ bandingMax.
 */
export function cleanupBanding(frames: readonly QaFrame[], ctx: QaContext): Check {
  let segments = 0;
  const where: [number, number][] = [];
  for (const { raster: r } of frames) {
    const band = new Uint8Array(r.w * r.h);
    const mono = (a: number, b: number, c: number): boolean => {
      const A = ctx.rampOf.get(a), B = ctx.rampOf.get(b), C = ctx.rampOf.get(c);
      if (!A || !B || !C || A.ramp !== B.ramp || B.ramp !== C.ramp) return false;
      return (A.step < B.step && B.step < C.step) || (A.step > B.step && B.step > C.step);
    };
    for (let y = 1; y < r.h - 1; y++) for (let x = 1; x < r.w - 1; x++) {
      const k = y * r.w + x, b = r.px[k] ?? 0;
      if (!b) continue;
      if (mono(r.px[k - 1] ?? 0, b, r.px[k + 1] ?? 0) || mono(r.px[k - r.w] ?? 0, b, r.px[k + r.w] ?? 0)) band[k] = 1;
    }
    const seen = new Uint8Array(band.length);
    for (let k = 0; k < band.length; k++) {
      if (!band[k] || seen[k]) continue;
      const stack = [k];
      seen[k] = 1;
      let size = 0;
      while (stack.length) {
        const j = stack.pop() ?? 0, x = j % r.w, y = (j - x) / r.w;
        size++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, n = Y * r.w + X;
          if (X >= 0 && Y >= 0 && X < r.w && Y < r.h && band[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      if (size < 2) continue;
      segments++;
      where.push([k % r.w, Math.floor(k / r.w)]);
    }
  }
  return check('cleanup.banding', false, segments <= ctx.rules.bandingMax, segments, ctx.rules.bandingMax, segments ? { where } : {});
}
