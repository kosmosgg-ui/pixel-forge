import { rotCS } from './types.js';
import type { MaskGrid } from './mask-grid.js';

const SUB = 8;
const EPS = 1e-9;

/** 64개 표본의 최빈값. 동률이면 칠해진 칸, 그다음 작은 키 */
function modeOf(keys: Int32Array): number {
  keys.sort();
  let best = 0, bestN = 0;
  for (let i = 0; i < keys.length; ) {
    let j = i;
    while (j < keys.length && keys[j] === keys[i]) j++;
    const k = keys[i] ?? 0, n = j - i;
    if (n > bestN || (n === bestN && bestN > 0 && best === 0 && k !== 0)) { best = k; bestN = n; }
    i = j;
  }
  return best;
}

/**
 * mask 파츠 전용 회전 (RotSprite 근사): 8배 최근접 확대 → 회전 → 8×8 블록 최빈값 축소.
 * 회전 중심은 앵커 칸의 중심.
 */
export function rotateMaskGrid(g: MaskGrid, angleDeg: number): MaskGrid {
  const [c, s] = rotCS(angleDeg);
  const ax = 0.5, ay = 0.5;
  const corners = [[g.ox, g.oy], [g.ox + g.w, g.oy], [g.ox, g.oy + g.h], [g.ox + g.w, g.oy + g.h]] as const;
  const rx = corners.map(([x, y]) => ax + (x - ax) * c - (y - ay) * s);
  const ry = corners.map(([x, y]) => ay + (x - ax) * s + (y - ay) * c);
  const x0 = Math.floor(Math.min(...rx) + EPS), y0 = Math.floor(Math.min(...ry) + EPS);
  const W = Math.ceil(Math.max(...rx) - EPS) - x0, H = Math.ceil(Math.max(...ry) - EPS) - y0;
  const keys = new Int32Array(W * H);
  const samples = new Int32Array(SUB * SUB);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    for (let l = 0; l < SUB; l++) for (let k = 0; k < SUB; k++) {
      const px = x0 + X + (k + 0.5) / SUB - ax, py = y0 + Y + (l + 0.5) / SUB - ay;
      const sx = Math.floor(ax + px * c + py * s) - g.ox, sy = Math.floor(ay - px * s + py * c) - g.oy;
      const i = sy * g.w + sx;
      const inside = sx >= 0 && sy >= 0 && sx < g.w && sy < g.h && g.mask[i] === 1;
      // 키 = 재질 << 10 | 단계 << 2 | 특수(눈·외곽선) — 회전 후에도 그리드 특수 칸을 잃지 않게
      samples[l * SUB + k] = inside ? ((g.material[i] ?? 0) << 10) | ((g.shade[i] ?? 0) << 2) | (g.special[i] ?? 0) : 0;
    }
    keys[Y * W + X] = modeOf(samples);
  }
  return trimKeys(keys, W, H, x0, y0, g.materials);
}

function trimKeys(keys: Int32Array, W: number, H: number, x0: number, y0: number, materials: string[]): MaskGrid {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (keys[y * W + x]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const w = Math.max(0, maxX - minX + 1), h = Math.max(0, maxY - minY + 1);
  const mask = new Uint8Array(w * h), material = new Uint8Array(w * h), shade = new Uint8Array(w * h), special = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const key = keys[(y + minY) * W + (x + minX)] ?? 0;
    if (!key) continue;
    const k = y * w + x;
    mask[k] = 1; material[k] = key >> 10; shade[k] = (key >> 2) & 255; special[k] = key & 3;
  }
  return { w, h, ox: x0 + (w ? minX : 0), oy: y0 + (h ? minY : 0), mask, materials, material, shade, special };
}
