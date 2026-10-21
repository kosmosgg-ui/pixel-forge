import { check, type Check, type QaContext, type QaFrame } from '../types.js';

/** 팔레트 밖 인덱스 0개 */
export function paletteConformance(frames: readonly QaFrame[], ctx: QaContext): Check {
  const where: [number, number][] = [];
  frames.forEach(({ raster: r }) => r.px.forEach((v, i) => { if (v >= ctx.palette.colors.length) where.push([i % r.w, Math.floor(i / r.w)]); }));
  return check('palette.conformance', true, where.length === 0, where.length, 0, where.length ? { where } : {});
}

/** 반투명 픽셀 0개: 칠해진 픽셀의 팔레트 색 알파가 255여야 한다 */
export function alphaBinary(frames: readonly QaFrame[], ctx: QaContext): Check {
  const where: [number, number][] = [];
  for (const { raster: r } of frames) {
    for (let i = 0; i < r.px.length; i++) {
      const v = r.px[i] ?? 0;
      const c = ctx.palette.colors[v];
      if (v !== 0 && c !== undefined && (c & 255) !== 255) where.push([i % r.w, Math.floor(i / r.w)]);
    }
  }
  return check('alpha.binary', true, where.length === 0, where.length, 0, where.length ? { where } : {});
}

/** 프레임 묶음 전체에서 실제로 쓰인 고유 색 수 ≤ 예산 (외곽선 톤·fx 포함) */
export function colorBudget(frames: readonly QaFrame[], ctx: QaContext): Check {
  const used = new Set<number>();
  for (const f of frames) for (const v of f.raster.px) if (v) used.add(v);
  return check('color.budget', true, used.size <= ctx.budget, used.size, ctx.budget);
}

/** 모든 프레임이 캔버스 안, 가장자리 1px은 비어 있어야 한다 */
export function boundsCanvas(frames: readonly QaFrame[]): Check {
  const where: [number, number][] = [];
  for (const { raster: r } of frames) {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if ((x === 0 || y === 0 || x === r.w - 1 || y === r.h - 1) && r.px[y * r.w + x]) where.push([x, y]);
    }
  }
  return check('bounds.canvas', true, where.length === 0, where.length, 0, where.length ? { where } : {});
}
