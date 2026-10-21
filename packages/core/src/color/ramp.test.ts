import { describe, expect, it } from 'vitest';
import { parseHex } from './hex.js';
import { oklabToOklch, srgbToOklab } from './oklab.js';
import { arcCrossesBand, inHueBand, makeRamp, planRamp, rotateHueToward, shortestHueDelta } from './ramp.js';
import { RAMP as rules } from './test-rules.js';

const lch = (hex: string) => oklabToOklch(srgbToOklab(...parseHex(hex)));
const BASES = ['#d9a07a', '#a83c3c', '#3f7a4a', '#3c5aa8', '#d8d2c4', '#6a3c8c', '#8c95a6', '#c9a23a', '#7a5634'];
const near = (h: number, t: number) => Math.abs(shortestHueDelta(h, t));

describe('hue 회전', () => {
  it('최단 각도 방향, 목표를 넘지 않음', () => {
    expect(shortestHueDelta(350, 10)).toBe(20);
    expect(shortestHueDelta(10, 350)).toBe(-20);
    expect(rotateHueToward(65, 70, 8)).toBe(70);
    expect(rotateHueToward(355, 5, 8)).toBe(3);
  });

  it('호가 대역을 지나는지', () => {
    expect(arcCrossesBand(85, 1, 40, [115, 165])).toBe(true);
    expect(arcCrossesBand(85, -1, 40, [115, 165])).toBe(false);
    expect(arcCrossesBand(10, -1, 260, [115, 165])).toBe(true);
  });
});

describe('makeRamp', () => {
  it('단계 수, 유효 hex, 2회 결과 동일', () => {
    for (const b of BASES) for (const steps of [3, 4, 5]) {
      const r = makeRamp(b, steps, 1, rules);
      expect(r).toHaveLength(steps);
      for (const h of r) expect(h).toMatch(/^#[0-9a-f]{6}$/);
      expect(makeRamp(b, steps, 1, rules)).toEqual(r);
    }
  });

  it('명도는 줄지 않고 L은 [minL, maxL] 안', () => {
    for (const b of BASES) for (const c of [0.8, 1, 1.4]) {
      const Ls = makeRamp(b, 5, c, rules).map((h) => lch(h).L);
      for (let i = 1; i < Ls.length; i++) expect(Ls[i]).toBeGreaterThanOrEqual((Ls[i - 1] ?? 0) - 0.002);
      for (const L of Ls) {
        expect(L).toBeGreaterThanOrEqual(rules.minL - 0.005);
        expect(L).toBeLessThanOrEqual(rules.maxL + 0.005);
      }
    }
  });

  it('밝은 쪽은 warmHue, 어두운 쪽은 coolHue에 가까워진다 (초록 회피가 없는 색)', () => {
    for (const b of ['#a83c3c', '#3c5aa8', '#6a3c8c']) {
      const r = makeRamp(b, 5, 1, rules);
      const base = lch(b).h;
      expect(near(lch(r[4] ?? '').h, rules.warmHue)).toBeLessThan(near(base, rules.warmHue));
      expect(near(lch(r[0] ?? '').h, rules.coolHue)).toBeLessThan(near(base, rules.coolHue));
    }
  });

  it('gold 그림자는 빨강 쪽(hue 감소)으로 돌고 초록 대역을 지나지 않는다', () => {
    const plan = planRamp('#c9a23a', 4, 1.4, rules);
    const base = lch('#c9a23a').h;
    expect(inHueBand(base, rules.avoidHueBand)).toBe(false);
    for (const c of [...plan.steps.slice(0, plan.mid), plan.outline]) {
      expect(shortestHueDelta(base, c.h)).toBeLessThan(0);
      expect(inHueBand(c.h, rules.avoidHueBand)).toBe(false);
    }
  });

  it('외곽선 톤은 ramp[0]보다 어둡고 채도가 낮다', () => {
    for (const b of BASES) {
      const p = planRamp(b, 4, 1, rules);
      expect(p.outline.L).toBeCloseTo((p.steps[0]?.L ?? 0) - rules.outlineToneDeltaL, 9);
      expect(p.outline.C).toBeCloseTo((p.steps[0]?.C ?? 0) * rules.outlineToneChroma, 9);
    }
  });

  it('가운데 단계는 기준색 그대로', () => {
    expect(makeRamp('#a83c3c', 5, 1, rules)[2]).toBe('#a83c3c');
  });
});
