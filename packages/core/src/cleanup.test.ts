import { describe, expect, it } from 'vitest';
import { mergeSmallClustersInPlace, removeOrphansInPlace } from './cleanup.js';
import { createZone } from './zone.js';

describe('removeOrphansInPlace', () => {
  it('외딴 점은 지우고, 다른 색 속 외톨이는 주변 색으로', () => {
    const r = { w: 5, h: 3, px: Uint8Array.from([
      0, 0, 0, 2, 2,
      0, 3, 0, 2, 4,
      0, 0, 0, 2, 2,
    ]) };
    expect(removeOrphansInPlace(r)).toBe(2);
    expect(Array.from(r.px)).toEqual([0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2]);
  });

  it('keep 인덱스(외곽선)는 건드리지 않는다', () => {
    const r = { w: 3, h: 1, px: Uint8Array.from([0, 9, 0]) };
    expect(removeOrphansInPlace(r, new Set([9]))).toBe(0);
  });
});

describe('mergeSmallClustersInPlace', () => {
  it('같은 재질 안 1px shade 섬을 주변 최빈 shade로', () => {
    const z = createZone(3, 3);
    z.material.fill(1);
    z.shade.set([2, 2, 2, 2, 0, 2, 1, 1, 1]);
    expect(mergeSmallClustersInPlace(z, 2)).toBe(1);
    expect(z.shade[4]).toBe(2);
  });

  it('다른 재질 경계는 넘지 않는다', () => {
    const z = createZone(2, 1);
    z.material.set([1, 2]);
    z.shade.set([0, 3]);
    expect(mergeSmallClustersInPlace(z, 2)).toBe(0);
  });
});
