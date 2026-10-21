import { describe, expect, it } from 'vitest';
import type { RampRules } from '@pixel-forge/spec';
import { parseHex } from './hex.js';
import { oklabToOklch, srgbToOklab } from './oklab.js';
import { makeRamp, rotateHueToward, shortestHueDelta } from './ramp.js';

const rules: RampRules = { id: 'color.ramp.hue-shift', steps: 5, deltaL: 0.11, hueShift: 8, warmHue: 70, coolHue: 260, chromaFalloff: 0.25 };
const lch = (hex: string) => oklabToOklch(srgbToOklab(...parseHex(hex)));
const BASES = ['#d9a07a', '#a83c3c', '#3f7a4a', '#3c5aa8', '#d8d2c4', '#6a3c8c', '#8c95a6', '#c9a23a', '#7a5634'];

describe('hue 회전', () => {
  it('최단 각도 방향', () => {
    expect(shortestHueDelta(350, 10)).toBe(20);
    expect(shortestHueDelta(10, 350)).toBe(-20);
    expect(shortestHueDelta(0, 180)).toBe(180);
  });

  it('목표를 넘지 않는다', () => {
    expect(rotateHueToward(65, 70, 8)).toBe(70);
    expect(rotateHueToward(355, 5, 8)).toBe(3);
    expect(rotateHueToward(300, 260, 8)).toBe(292);
  });
});

describe('makeRamp', () => {
  it('단계 수, 유효 hex, 결정론', () => {
    for (const b of BASES) for (const steps of [3, 4, 5]) {
      const r = makeRamp(b, steps, 1, rules);
      expect(r).toHaveLength(steps);
      for (const h of r) expect(h).toMatch(/^#[0-9a-f]{6}$/);
      expect(makeRamp(b, steps, 1, rules)).toEqual(r);
    }
  });

  it('명도는 어두움 → 밝음으로 줄지 않는다', () => {
    for (const b of BASES) for (const c of [0.8, 1, 1.4]) {
      const Ls = makeRamp(b, 5, c, rules).map((h) => lch(h).L);
      for (let i = 1; i < Ls.length; i++) expect(Ls[i]).toBeGreaterThanOrEqual(Ls[i - 1] ?? 0);
    }
  });

  it('흰색에 닿지 않는 범위에서는 단계마다 명도가 올라간다', () => {
    for (const b of BASES) for (const c of [0.8, 1]) {
      const Ls = makeRamp(b, 4, c, rules).map((h) => lch(h).L);
      for (let i = 1; i < Ls.length; i++) expect(Ls[i]).toBeGreaterThan(Ls[i - 1] ?? 0);
    }
  });

  it('밝은 쪽은 warmHue, 어두운 쪽은 coolHue에 가까워진다', () => {
    for (const b of ['#a83c3c', '#3f7a4a', '#3c5aa8', '#6a3c8c']) {
      const r = makeRamp(b, 5, 1, rules);
      const base = lch(b).h;
      const near = (h: number, t: number) => Math.abs(shortestHueDelta(h, t));
      expect(near(lch(r[4] ?? '').h, rules.warmHue)).toBeLessThan(near(base, rules.warmHue));
      expect(near(lch(r[0] ?? '').h, rules.coolHue)).toBeLessThan(near(base, rules.coolHue));
    }
  });

  it('가운데 단계는 기준색 그대로', () => {
    expect(makeRamp('#a83c3c', 5, 1, rules)[2]).toBe('#a83c3c');
  });
});
