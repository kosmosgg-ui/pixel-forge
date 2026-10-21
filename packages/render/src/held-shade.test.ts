import { describe, expect, it } from 'vitest';
import { createFrameZone } from './frame-zone.js';
import { heldThinShadeInPlace } from './held-shade.js';
import type { PartRaster } from './rasterize-part.js';

describe('heldThinShadeInPlace', () => {
  it('몸체는 가장 밝은 2단계만, 부착점 쪽 1px·가장 먼 1px만 0단계', () => {
    // 6×2 날, 관절은 왼쪽 위 (0,0) 바로 왼쪽
    const z = createFrameZone(6, 2);
    z.material.fill(1);
    z.shade.set([0, 1, 2, 3, 4, 2, 0, 0, 1, 1, 4, 3]);
    const r: PartRaster = { x0: 0, y0: 0, w: 6, h: 2, mask: new Uint8Array(12).fill(1), material: new Uint8Array(12).fill(1), fixed: new Uint8Array(12) };
    heldThinShadeInPlace(z, r, [-1, 0], 5, 2);
    const s = Array.from(z.shade);
    expect(s[0]).toBe(0);
    expect(s[11]).toBe(0);
    expect(s.filter((v, i) => i !== 0 && i !== 11).every((v) => v === 3 || v === 4)).toBe(true);
    expect(s[4]).toBe(4);
    expect(s[1]).toBe(3);
  });
});
