import { describe, expect, it } from 'vitest';
import { addColor, createPalette, hexToRgba } from '@pixel-forge/core';
import { analyzeRef } from './ref-analyze.js';
import { palette, raster } from './test-fixture.js';

// 1~3 = 빨강 램프(어둠·기본·밝음), 4 = 파랑
describe('analyzeRef', () => {
  it('실루엣 상자·키, 고유 색 수, 같은 hue는 한 램프(명도순)', () => {
    const m = analyzeRef(raster(['......', '.1111.', '.1231.', '.1341.', '.1111.', '......']), palette());
    expect(m.canvas).toEqual([6, 6]);
    expect(m.silhouette).toMatchObject({ bbox: [1, 1, 4, 4], heightPx: 4, widthPx: 4, opaque: 16 });
    expect(m.uniqueColors).toBe(4);
    expect(m.ramps[0]?.colors).toEqual(['#402020', '#a03030', '#e06060']);
    expect(m.ramps).toHaveLength(2);
  });

  it('외곽선: 테두리가 전부 어두운 한 색 → dark, 안쪽보다 어두운 같은 램프 → selout, 그 밖 → none', () => {
    let p = createPalette();
    for (const h of ['#101010', '#a03030', '#e06060', '#602020']) p = addColor(p, hexToRgba(h), h).palette;
    expect(analyzeRef(raster(['1111', '1231', '1321', '1111']), p).outline.type).toBe('dark');
    expect(analyzeRef(raster(['4444', '4234', '4324', '4444']), p).outline.type).toBe('selout');
    expect(analyzeRef(raster(['3333', '3223', '3223', '3333']), p).outline.type).toBe('none');
  });

  it('머리 비율: 위 절반에서 가장 좁은 줄(목)까지 ÷ 키, 결정론', () => {
    const fig = ['.111.', '.111.', '.111.', '..1..', '11111', '11111', '11111', '.1.1.', '.1.1.', '.1.1.'];
    const a = analyzeRef(raster(fig), palette()), b = analyzeRef(raster(fig), palette());
    expect(a.headRatio).toBe(0.3);
    expect(a).toEqual(b);
  });
});
