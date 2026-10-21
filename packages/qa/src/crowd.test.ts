import { describe, expect, it } from 'vitest';
import { crowdSheet } from './crowd.js';
import { palette, raster } from './test-fixture.js';

describe('crowdSheet', () => {
  const sprites = [raster(['.2.', '222', '.2.']), raster(['44', '44'])];
  const o = { w: 40, h: 20, count: 30, seed: 1, background: '#2a2238' };

  it('같은 시드 → 같은 배치·같은 픽셀, 시드가 다르면 다른 배치', () => {
    const a = crowdSheet(sprites, palette(), o), b = crowdSheet(sprites, palette(), o);
    expect(Array.from(a.raster.px)).toEqual(Array.from(b.raster.px));
    expect(crowdSheet(sprites, palette(), { ...o, seed: 2 }).placements).not.toEqual(a.placements);
  });

  it('개수만큼 놓이고 전부 시트 안, 배경은 바이블 배경색', () => {
    const s = crowdSheet(sprites, palette(), o);
    expect(s.placements).toHaveLength(30);
    for (const [i, x, y] of s.placements) {
      const r = sprites[i]!;
      expect(x + r.w).toBeLessThanOrEqual(o.w);
      expect(y + r.h).toBeLessThanOrEqual(o.h);
    }
    expect(s.raster.px[0]).toBe(s.palette.colors.length - 1);
  });
});
