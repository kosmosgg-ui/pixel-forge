import { describe, expect, it } from 'vitest';
import { oklabToOklch, oklabToSrgb, oklchToOklab, oklchToSrgbInGamut, srgbToOklab } from './oklab.js';

describe('oklab', () => {
  it('sRGB → OKLab → sRGB 왕복 오차 ≤ 1/255', () => {
    for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
      const [r2, g2, b2] = oklabToSrgb(srgbToOklab(r, g, b));
      expect(Math.max(Math.abs(r - r2), Math.abs(g - g2), Math.abs(b - b2))).toBeLessThanOrEqual(1);
    }
  });

  it('OKLab ↔ OKLCh 왕복', () => {
    const lab = srgbToOklab(168, 60, 60);
    const back = oklchToOklab(oklabToOklch(lab));
    expect(back.a).toBeCloseTo(lab.a, 12);
    expect(back.b).toBeCloseTo(lab.b, 12);
  });

  it('흰색 L≈1, 검정 L≈0', () => {
    expect(srgbToOklab(255, 255, 255).L).toBeCloseTo(1, 4);
    expect(srgbToOklab(0, 0, 0).L).toBeCloseTo(0, 6);
  });

  it('범위 밖 색은 C만 줄여 유효한 정수 sRGB로', () => {
    const lch = { L: 0.7, C: 0.4, h: 140 };
    const rgb = oklchToSrgbInGamut(lch);
    for (const v of rgb) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    const out = oklabToOklch(srgbToOklab(...rgb));
    expect(out.L).toBeCloseTo(0.7, 2);
    expect(Math.abs(out.h - 140)).toBeLessThan(2);
    expect(out.C).toBeLessThan(0.4);
  });
});
