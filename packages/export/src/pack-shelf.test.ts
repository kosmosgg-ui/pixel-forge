import { describe, expect, it } from 'vitest';
import { createIndexed } from '@pixel-forge/core';
import { packShelf, type PackItem } from './pack-shelf.js';

const box = (name: string, w: number, h: number, v: number): PackItem => {
  const r = createIndexed(w, h);
  r.px.fill(v);
  return { name, raster: r };
};
const items = [box('a', 5, 4, 1), box('b', 3, 6, 2), box('c', 5, 4, 3), box('d', 2, 2, 4), box('e', 7, 3, 5)];

describe('packShelf', () => {
  it('프레임 겹침 0, 패딩 1px 유지, 시트 안', () => {
    const { sheet, rects } = packShelf(items);
    rects.forEach((a, i) => {
      expect(a.x).toBeGreaterThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(1);
      expect(a.x + a.w + 1).toBeLessThanOrEqual(sheet.w);
      expect(a.y + a.h + 1).toBeLessThanOrEqual(sheet.h);
      rects.forEach((b, j) => {
        if (i >= j) return;
        const apart = a.x + a.w + 1 <= b.x || b.x + b.w + 1 <= a.x || a.y + a.h + 1 <= b.y || b.y + b.h + 1 <= a.y;
        expect(apart).toBe(true);
      });
    });
    // 각 칸의 픽셀이 제자리에 복사됨
    for (const [i, r] of rects.entries()) expect(sheet.px[r.y * sheet.w + r.x]).toBe(i + 1);
  });

  it('결정론: 같은 입력 → 같은 크기·배치·픽셀, 순서 유지', () => {
    const a = packShelf(items), b = packShelf(items);
    expect([a.sheet.w, a.sheet.h]).toEqual([b.sheet.w, b.sheet.h]);
    expect(a.rects).toEqual(b.rects);
    expect(Array.from(a.sheet.px)).toEqual(Array.from(b.sheet.px));
    expect(a.rects.map((r) => r.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('pow2 옵션은 시트 크기를 2의 거듭제곱으로', () => {
    const { sheet } = packShelf(items, { pow2: true });
    for (const n of [sheet.w, sheet.h]) expect(n & (n - 1)).toBe(0);
  });
});
