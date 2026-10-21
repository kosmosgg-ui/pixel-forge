import { describe, expect, it } from 'vitest';
import { blitInPlace, createIndexed, equals, flipX, getPx, scaleNearest, setPxInPlace } from './raster.js';

describe('raster', () => {
  it('경계 밖 읽기는 0, 쓰기는 무시', () => {
    const r = createIndexed(2, 2);
    setPxInPlace(r, 5, 5, 3);
    setPxInPlace(r, 1, 0, 3);
    expect(getPx(r, -1, 0)).toBe(0);
    expect(getPx(r, 1, 0)).toBe(3);
    expect(Array.from(r.px)).toEqual([0, 3, 0, 0]);
  });

  it('blit은 투명을 건너뛰고 잘라낸다', () => {
    const dst = createIndexed(3, 1);
    dst.px.set([1, 1, 1]);
    const src = { w: 2, h: 1, px: Uint8Array.from([0, 2]) };
    blitInPlace(dst, src, 2, 0);
    expect(Array.from(dst.px)).toEqual([1, 1, 1]);
    blitInPlace(dst, src, 0, 0);
    expect(Array.from(dst.px)).toEqual([1, 2, 1]);
  });

  it('flipX 두 번이면 원래대로', () => {
    const r = { w: 3, h: 2, px: Uint8Array.from([1, 2, 3, 4, 5, 6]) };
    expect(Array.from(flipX(r).px)).toEqual([3, 2, 1, 6, 5, 4]);
    expect(equals(flipX(flipX(r)), r)).toBe(true);
  });

  it('scaleNearest는 블록 복제만 한다', () => {
    const r = { w: 2, h: 1, px: Uint8Array.from([1, 2]) };
    const s = scaleNearest(r, 2);
    expect([s.w, s.h]).toEqual([4, 2]);
    expect(Array.from(s.px)).toEqual([1, 1, 2, 2, 1, 1, 2, 2]);
    expect(() => scaleNearest(r, 1.5)).toThrow(RangeError);
  });
});
