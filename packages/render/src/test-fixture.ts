import { buildBiblePalette } from '@pixel-forge/core';
import { bibleSchema, rigSchema, rulesSchema, specSchema, type Bible, type Rig, type Rules, type Spec } from '@pixel-forge/spec';
import rulesJson from '../../../data/rules/default.rules.json' with { type: 'json' };
import type { RenderContext } from './render-frame.js';

export const RULES: Rules = rulesSchema.parse(rulesJson);

export function bible(over: Partial<Record<string, unknown>> = {}): Bible {
  return bibleSchema.parse({
    id: 't', view: 'side', directions: 1, sizeClasses: { s: [24, 24] }, pivot: 'bottom-center', facing: 'right',
    background: '#202020', light: { dir: [-0.6, -0.7, 0.4], ambient: 0.15 }, outline: { mode: 'selout', globalColor: '#101018' },
    colorBudget: { s: 15 }, materials: { m: { base: '#a83c3c', steps: 4, kind: 'cloth' } }, fxColors: [], ...over,
  });
}

/** 루트 하나(각도 0)와 뒤쪽 뼈 하나 */
export function rig(names: [string, string] = ['root', 'back']): Rig {
  return rigSchema.parse({
    id: 'r', view: 'side', facing: 'right', baseHeight: 10,
    bones: {
      [names[0]]: { parent: null, pivot: [0, 0], length: 0, restAngle: 0, depthLayer: 'mid' },
      [names[1]]: { parent: names[0], pivot: [0, 0], length: 0, restAngle: 0, depthLayer: 'back' },
    },
    drawOrder: [names[1], names[0]],
  });
}

export function spec(parts: unknown[], over: Record<string, unknown> = {}): Spec {
  return specSchema.parse({ id: 'one', kind: 'character', bible: 't', sizeClass: 's', rig: 'r', parts, ...over });
}

export const circle = (bone = 'root', w = 9) => ({ bone, shape: { type: 'ellipse', w, h: w }, material: 'm', orient: 'world' });

export function ctx(s: Spec, b: Bible = bible(), r: Rig = rig()): RenderContext {
  return { spec: s, bible: b, rules: RULES, rig: r, palette: buildBiblePalette(b, RULES) };
}
