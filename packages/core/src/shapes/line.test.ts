import { describe, expect, it } from 'vitest';
import { bresenham, rasterLine } from './line.js';
import { at, count } from './test-util.js';
import type { ShapeMask } from './types.js';

/** L자 모서리: 칠해진 b가 직교 이웃 a, c를 갖고 a와 c가 대각선으로 붙은 경우 */
function lCorners(m: ShapeMask): number {
  let n = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!at(m, x, y)) continue;
    const h = [at(m, x - 1, y), at(m, x + 1, y)];
    const v = [at(m, x, y - 1), at(m, x, y + 1)];
    if ((h[0] || h[1]) && (v[0] || v[1])) n++;
  }
  return n;
}

describe('line', () => {
  it('Bresenham 끝점 포함', () => {
    const p = bresenham(0, 0, 3, 1);
    expect(p[0]).toEqual([0, 0]);
    expect(p[p.length - 1]).toEqual([3, 1]);
  });

  it('대각선 1px 선에 L자 모서리 0개', () => {
    for (const to of [[7, 7], [10, 3], [3, 10], [9, -4], [-6, 5]] as const) {
      expect(lCorners(rasterLine({ to }))).toBe(0);
    }
  });

  it('pixelPerfect를 끄면 L자가 남을 수 있다 (비교용)', () => {
    const raw = rasterLine({ to: [10, 3], pixelPerfect: false });
    expect(count(raw)).toBeGreaterThanOrEqual(count(rasterLine({ to: [10, 3] })));
  });
});
