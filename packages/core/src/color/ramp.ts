import type { RampRules } from '@pixel-forge/spec';
import { parseHex, toHex } from './hex.js';
import { oklabToOklch, oklchToSrgbInGamut, srgbToOklab } from './oklab.js';

export interface Ramp {
  id: string;
  /** 팔레트 인덱스, 어두움 → 밝음 */
  indices: number[];
}

/** from에서 to로 가는 최단 각도, (-180, 180] */
export function shortestHueDelta(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** 최단 방향으로 amount°만큼 돌리되 목표를 넘지 않는다 */
export function rotateHueToward(h: number, target: number, amount: number): number {
  const d = shortestHueDelta(h, target);
  const step = Math.sign(d) * Math.min(Math.abs(d), amount);
  return (((h + step) % 360) + 360) % 360;
}

/**
 * rule: color.ramp.hue-shift
 * 기준색은 가운데 단계(짝수 단계면 어두운 쪽 가운데). 밝을수록 warmHue, 어두울수록 coolHue로 돌고 채도는 양끝에서 줄어든다.
 */
export function makeRamp(baseHex: string, steps: number, contrast: number, rules: RampRules): string[] {
  const base = oklabToOklch(srgbToOklab(...parseHex(baseHex)));
  const mid = Math.floor((steps - 1) / 2);
  const maxDist = Math.max(mid, steps - 1 - mid, 1);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const d = i - mid;
    const target = d > 0 ? rules.warmHue : rules.coolHue;
    const h = d === 0 ? base.h : rotateHueToward(base.h, target, Math.abs(d) * rules.hueShift);
    const C = base.C * (1 - (rules.chromaFalloff * Math.abs(d)) / maxDist);
    const L = base.L + d * rules.deltaL * contrast;
    out.push(toHex(...oklchToSrgbInGamut({ L, C, h })));
  }
  return out;
}
