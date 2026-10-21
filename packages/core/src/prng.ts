export interface Prng {
  /** [0, 1) 실수 */
  next(): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
}

// mulberry32: 상태 32비트 하나라 시드만 같으면 플랫폼과 무관하게 같은 수열이 나온다
export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return { next, int };
}
