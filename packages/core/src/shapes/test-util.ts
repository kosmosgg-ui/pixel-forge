import type { ShapeMask } from './types.js';

export const count = (m: ShapeMask): number => m.mask.reduce((a, v) => a + v, 0);

export const at = (m: ShapeMask, x: number, y: number): number =>
  x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.mask[y * m.w + x] ?? 0;

export function isMirrorX(m: ShapeMask): boolean {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y) !== at(m, m.w - 1 - x, y)) return false;
  return true;
}

export function isMirrorY(m: ShapeMask): boolean {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y) !== at(m, x, m.h - 1 - y)) return false;
  return true;
}

/** 칠해진 픽셀이 전부 4-연결로 이어져 있는지 */
export function is4Connected(m: ShapeMask): boolean {
  const start = m.mask.indexOf(1);
  if (start < 0) return true;
  const seen = new Uint8Array(m.mask.length);
  const stack = [start];
  seen[start] = 1;
  let n = 0;
  while (stack.length) {
    const k = stack.pop() ?? 0;
    n++;
    const x = k % m.w, y = (k - x) / m.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy, j = Y * m.w + X;
      if (at(m, X, Y) && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  return n === count(m);
}

/** 바운딩 박스 실제 폭(칠해진 열 수) */
export function filledWidth(m: ShapeMask): number {
  let n = 0;
  for (let x = 0; x < m.w; x++) for (let y = 0; y < m.h; y++) if (at(m, x, y)) { n++; break; }
  return n;
}
