import { ForgeError } from '../errors.js';
import { rotCS, writeNormal, type ShapeMask } from './types.js';

export interface PolyParams {
  /** 앵커 기준 꼭짓점(px). 픽셀 (x, y)는 [x, x+1] × [y, y+1] */
  pts: readonly (readonly [number, number])[];
  normalHint?: readonly [number, number, number];
  angleDeg?: number;
}

const MAX_POINTS = 12;

function insideEvenOdd(px: number, py: number, xs: readonly number[], ys: readonly number[]): boolean {
  let inside = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    const xi = xs[i] ?? 0, yi = ys[i] ?? 0, xj = xs[j] ?? 0, yj = ys[j] ?? 0;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 스캔라인 짝홀 규칙: 픽셀 중심이 다각형 안이면 채운다 */
export function rasterPoly({ pts, normalHint = [0, 0, 1], angleDeg = 0 }: PolyParams): ShapeMask {
  if (pts.length < 3) throw new ForgeError('shape.poly.too-few-points', '다각형은 꼭짓점이 3개 이상이어야 합니다');
  if (pts.length > MAX_POINTS) throw new ForgeError('shape.poly.too-many-points', `다각형 꼭짓점은 최대 ${MAX_POINTS}개입니다`);
  const [c, s] = rotCS(angleDeg);
  const xs = pts.map(([x, y]) => x * c - y * s);
  const ys = pts.map(([x, y]) => x * s + y * c);
  const ox = Math.floor(Math.min(...xs));
  const oy = Math.floor(Math.min(...ys));
  const W = Math.max(1, Math.ceil(Math.max(...xs)) - ox);
  const H = Math.max(1, Math.ceil(Math.max(...ys)) - oy);
  const mask = new Uint8Array(W * H);
  const normals = new Int8Array(W * H * 3);
  const [hx, hy, hz] = normalHint;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!insideEvenOdd(ox + i + 0.5, oy + j + 0.5, xs, ys)) continue;
      const k = j * W + i;
      mask[k] = 1;
      writeNormal(normals, k, hx * c - hy * s, hx * s + hy * c, hz);
    }
  }
  return { w: W, h: H, ox, oy, mask, normals };
}
