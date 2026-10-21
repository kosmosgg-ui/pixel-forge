import { describe, expect, it } from 'vitest';
import { reviewSheet } from './review.js';
import { palette, raster } from './test-fixture.js';

describe('reviewSheet', () => {
  const a = raster(['.2', '22']), b = raster(['3.', '33']);
  const chars = [[[a], [a, b]], [[b], [b]]];

  it('캐릭터마다 묶음을 가장 긴 애니 칸 수로 줄 채움, 배경은 바이블 배경색, scale배 최근접 확대', () => {
    const s = reviewSheet(chars, palette(), { scale: 4, background: '#2a2238' });
    const bg = s.palette.colors.length - 1;
    expect(s.cell).toEqual([8, 8]);
    // cols 2: 캐릭터 1 = [a] | [a,b] 두 줄, 캐릭터 2 = [b][b] 한 줄, 캐릭터 사이 한 칸
    expect(s.cols).toBe(2);
    expect(s.raster.h).toBe(4 + 3 * (8 + 4) + 8);
    expect(s.raster.px[0]).toBe(bg);
    // 첫 칸 (gap 4, gap 4)에서 원본 (1,0) = 2 → 확대 후 x 8..11, y 4..7
    expect(s.raster.px[4 * s.raster.w + 8]).toBe(2);
    expect(s.raster.px[4 * s.raster.w + 4]).toBe(bg);
  });

  it('결정론: 같은 입력 → 같은 픽셀', () => {
    const o = { scale: 2, background: '#101010' };
    expect(Array.from(reviewSheet(chars, palette(), o).raster.px)).toEqual(Array.from(reviewSheet(chars, palette(), o).raster.px));
  });
});
