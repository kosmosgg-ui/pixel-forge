import { boxSize, INSIDE_EPS, rasterizeLocal, rotCS, type ShapeMask } from './types.js';

export interface RectParams {
  w: number;
  h: number;
  /** 모서리 깎기(px). 1이면 네 귀퉁이 1픽셀 */
  chamfer?: number;
  angleDeg?: number;
}

const BEVEL_TILT = 0.6;

export function rasterRect({ w, h, chamfer = 0, angleDeg = 0 }: RectParams): ShapeMask {
  const [c, s] = rotCS(angleDeg);
  const a = w / 2;
  const b = h / 2;
  const swap = Math.abs(s) > Math.abs(c);
  const W = boxSize(Math.abs(a * c) + Math.abs(b * s), swap ? h : w);
  const H = boxSize(Math.abs(a * s) + Math.abs(b * c), swap ? w : h);
  return rasterizeLocal({ W, H, c, s }, (lu, lv) => {
    const du = a - Math.abs(lu);
    const dv = b - Math.abs(lv);
    if (du < -INSIDE_EPS || dv < -INSIDE_EPS) return null;
    // 픽셀 단위 모서리 거리: 귀퉁이 픽셀은 (0.5 + 0.5)
    if (chamfer > 0 && du + dv < chamfer + 1 - INSIDE_EPS) return null;
    // 평면 + 가장자리 1px 베벨
    const bu = du < 1 ? Math.sign(lu) * BEVEL_TILT : 0;
    const bv = dv < 1 ? Math.sign(lv) * BEVEL_TILT : 0;
    return [bu, bv, 1];
  });
}
