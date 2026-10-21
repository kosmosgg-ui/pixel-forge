import { boxSize, INSIDE_EPS, rasterizeLocal, rotCS, type ShapeMask } from './types.js';

export interface CapsuleParams {
  /** 축 방향 전체 길이(px, 양끝 둥근 부분 포함). 회전 0°에서 바운딩 박스 = len × w */
  len: number;
  /** 두께(px), 짝수 허용 */
  w: number;
  angleDeg?: number;
}

export function rasterCapsule({ len, w, angleDeg = 0 }: CapsuleParams): ShapeMask {
  const L = Math.max(len, w);
  const [c, s] = rotCS(angleDeg);
  const r = w / 2;
  const half = (L - w) / 2;
  const swap = Math.abs(s) > Math.abs(c);
  const W = boxSize(half * Math.abs(c) + r, swap ? w : L);
  const H = boxSize(half * Math.abs(s) + r, swap ? L : w);
  return rasterizeLocal({ W, H, c, s }, (lu, lv) => {
    const du = lu - Math.min(half, Math.max(-half, lu));
    const d2 = du * du + lv * lv;
    if (d2 > r * r + INSIDE_EPS) return null;
    // 원기둥(몸통) + 구(양끝) 법선
    const nu = du / r;
    const nv = lv / r;
    return [nu, nv, Math.sqrt(Math.max(0, 1 - nu * nu - nv * nv))];
  });
}
