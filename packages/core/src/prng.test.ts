import { describe, expect, it } from 'vitest';
import { createPrng } from './prng.js';

const take = (seed: number, n: number): number[] => {
  const r = createPrng(seed);
  return Array.from({ length: n }, () => r.next());
};

describe('createPrng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('알려진 값으로 고정된다', () => {
    // mulberry32 seed 1 의 첫 값 — 구현이 바뀌면 렌더 결과 전체가 바뀌므로 고정
    expect(take(1, 1)[0]).toBeCloseTo(0.6270739405881613, 15);
  });

  it('next는 [0,1), int는 양 끝 포함 범위다', () => {
    const r = createPrng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const k = r.int(-2, 3);
      expect(k).toBeGreaterThanOrEqual(-2);
      expect(k).toBeLessThanOrEqual(3);
    }
  });
});
