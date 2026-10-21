import { boxSize, INSIDE_EPS, rasterizeLocal, rotCS, type ShapeMask } from './types.js';

export interface EllipseParams {
  w: number;
  h: number;
  angleDeg?: number;
}

/** 바운딩 박스 w×h, 픽셀 중심 판정 (u/(w/2))² + (v/(h/2))² ≤ 1. u, v는 박스 중심에서 픽셀 중심까지 */
export function rasterEllipse({ w, h, angleDeg = 0 }: EllipseParams): ShapeMask {
  const [c, s] = rotCS(angleDeg);
  const a = w / 2;
  const b = h / 2;
  const swap = Math.abs(s) > Math.abs(c);
  const W = boxSize(Math.hypot(a * c, b * s), swap ? h : w);
  const H = boxSize(Math.hypot(a * s, b * c), swap ? w : h);
  return rasterizeLocal({ W, H, c, s }, (lu, lv) => {
    const nu = lu / a;
    const nv = lv / b;
    const d = nu * nu + nv * nv;
    if (d > 1 + INSIDE_EPS) return null;
    // 구(sphere) 법선
    return [nu, nv, Math.sqrt(Math.max(0, 1 - d))];
  });
}
