import { rotCS, type ShapeMask } from './types.js';

export interface LineParams {
  to: readonly [number, number];
  from?: readonly [number, number];
  angleDeg?: number;
  /** L자 모서리 제거 (rule: form.cleanup pixelPerfectLines) */
  pixelPerfect?: boolean;
}

export function bresenham(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** 가운데 점이 앞뒤 점과 각각 직교로 붙고 앞뒤 점끼리는 대각선이면 그 점을 뺀다 */
export function pixelPerfectPath(pts: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    out.push([p[0], p[1]]);
    if (out.length < 3) continue;
    const a = out[out.length - 3], b = out[out.length - 2], c = out[out.length - 1];
    if (!a || !b || !c) continue;
    const ortho = (p: readonly number[], q: readonly number[]) => p[0] === q[0] || p[1] === q[1];
    if (ortho(a, b) && ortho(b, c) && a[0] !== c[0] && a[1] !== c[1]) out.splice(out.length - 2, 1);
  }
  return out;
}

export function rasterLine({ to, from = [0, 0], angleDeg = 0, pixelPerfect = true }: LineParams): ShapeMask {
  const [c, s] = rotCS(angleDeg);
  const rot = ([x, y]: readonly [number, number]) => [Math.round(x * c - y * s), Math.round(x * s + y * c)] as const;
  const [x0, y0] = rot(from);
  const [x1, y1] = rot(to);
  const raw = bresenham(x0, y0, x1, y1);
  const pts = pixelPerfect ? pixelPerfectPath(raw) : raw;
  const ox = Math.min(x0, x1), oy = Math.min(y0, y1);
  const W = Math.abs(x1 - x0) + 1, H = Math.abs(y1 - y0) + 1;
  const mask = new Uint8Array(W * H);
  for (const [x, y] of pts) mask[(y - oy) * W + (x - ox)] = 1;
  return { w: W, h: H, ox, oy, mask };
}
