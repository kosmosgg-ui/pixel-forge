import type { RampRules, RulesColor } from '@pixel-forge/spec';

/** data/rules/default.rules.json의 ramp와 같은 값 (core 테스트는 파일을 읽지 않는다) */
export const RAMP: RampRules = {
  id: 'color.ramp.hue-shift', steps: 5, deltaL: 0.11, hueShift: 8, warmHue: 70, coolHue: 260, chromaFalloff: 0.25,
  minL: 0.18, maxL: 0.93, avoidHueBand: [115, 165], reservedMinDistance: 0.03, collisionNudgeL: 0.02,
  collisionMaxNudges: 5, outlineToneDeltaL: 0.08, outlineToneChroma: 0.6,
};

export const RULES: RulesColor = { ramp: RAMP, materialContrast: { default: 1, metal: 1.4, cloth: 0.8, skin: 0.9 } };
