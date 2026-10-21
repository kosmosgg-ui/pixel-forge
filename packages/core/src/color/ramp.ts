import type { RampRules } from '@pixel-forge/spec';
import { parseHex, toHex } from './hex.js';
import { oklabToOklch, oklchToSrgbInGamut, srgbToOklab, type Lch } from './oklab.js';

export interface Ramp {
  id: string;
  /** 팔레트 인덱스, 어두움 → 밝음 */
  indices: number[];
  /** 재질 전용 외곽선 톤 (램프 밖) */
  outline: number;
}

/** 램프 설계값: 색역 맞춤·충돌 조정 전의 OKLCh */
export interface RampPlan {
  steps: Lch[];
  /** 기준색 단계 */
  mid: number;
  outline: Lch;
}

const norm = (h: number): number => ((h % 360) + 360) % 360;

/** from에서 to로 가는 최단 각도, (-180, 180] */
export function shortestHueDelta(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** 최단 방향으로 amount°만큼 돌리되 목표를 넘지 않는다 */
export function rotateHueToward(h: number, target: number, amount: number): number {
  const d = shortestHueDelta(h, target);
  return norm(h + Math.sign(d) * Math.min(Math.abs(d), amount));
}

export const inHueBand = (h: number, [lo, hi]: readonly [number, number]): boolean => norm(h) >= lo && norm(h) <= hi;

/** start에서 dir 방향으로 len°만큼 도는 호가 [lo, hi] 대역과 겹치는지 */
export function arcCrossesBand(start: number, dir: 1 | -1, len: number, [lo, hi]: readonly [number, number]): boolean {
  const a = norm(dir > 0 ? start : start - len);
  for (const k of [-360, 0, 360]) if (a <= hi + k && a + len >= lo + k) return true;
  return false;
}

export interface HuePath {
  dir: 1 | -1;
  /** 목표 hue까지 남은 각도 (넘지 않음) */
  limit: number;
}

/** rule: color.ramp.hue-shift — 목표 hue까지의 최단 경로가 회피 대역을 지나면(기준색은 대역 밖) 반대로 돈다 */
export function huePath(baseH: number, target: number, band: readonly [number, number]): HuePath {
  const d = shortestHueDelta(baseH, target);
  const dir: 1 | -1 = d >= 0 ? 1 : -1;
  const limit = Math.abs(d);
  if (!inHueBand(baseH, band) && arcCrossesBand(baseH, dir, limit, band)) {
    return { dir: dir === 1 ? -1 : 1, limit: 360 - limit };
  }
  return { dir, limit };
}

export const hueAt = (baseH: number, p: HuePath, amount: number): number => norm(baseH + p.dir * Math.min(amount, p.limit));

/**
 * 기준색은 가운데 단계(짝수 단계면 어두운 쪽 가운데). 밝을수록 warmHue, 어두울수록 coolHue로 돌고,
 * 채도는 양끝에서 줄고, L은 [minL, maxL]로 클램프한다. 외곽선 톤은 그림자 방향으로 한 단계 더.
 */
export function planRamp(baseHex: string, steps: number, contrast: number, rules: RampRules): RampPlan {
  const base = oklabToOklch(srgbToOklab(...parseHex(baseHex)));
  const mid = Math.floor((steps - 1) / 2);
  const maxDist = Math.max(mid, steps - 1 - mid, 1);
  const band = rules.avoidHueBand;
  const light = huePath(base.h, rules.warmHue, band);
  const dark = huePath(base.h, rules.coolHue, band);
  const out: Lch[] = [];
  for (let i = 0; i < steps; i++) {
    const d = i - mid;
    const h = d === 0 ? base.h : hueAt(base.h, d > 0 ? light : dark, Math.abs(d) * rules.hueShift);
    const C = base.C * (1 - (rules.chromaFalloff * Math.abs(d)) / maxDist);
    const L = Math.min(rules.maxL, Math.max(rules.minL, base.L + d * rules.deltaL * contrast));
    out.push({ L, C, h });
  }
  const first = out[0] ?? base;
  const outline: Lch = {
    L: Math.max(0, first.L - rules.outlineToneDeltaL),
    C: first.C * rules.outlineToneChroma,
    h: hueAt(base.h, dark, (mid + 1) * rules.hueShift),
  };
  return { steps: out, mid, outline };
}

export const lchToHex = (c: Lch): string => toHex(...oklchToSrgbInGamut(c));

/** 충돌 조정 없이 램프 단계만 hex로 (어두움 → 밝음) */
export function makeRamp(baseHex: string, steps: number, contrast: number, rules: RampRules): string[] {
  return planRamp(baseHex, steps, contrast, rules).steps.map(lchToHex);
}
