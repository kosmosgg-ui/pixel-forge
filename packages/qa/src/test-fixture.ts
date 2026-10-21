import { addColor, createPalette, hexToRgba, type IndexedRaster, type Palette } from '@pixel-forge/core';
import { rulesSchema } from '@pixel-forge/spec';
import rulesJson from '../../../data/rules/default.rules.json' with { type: 'json' };
import type { QaContext, QaFrame } from './types.js';

export const RULES = rulesSchema.parse(rulesJson).qa;

/** 1~3: 한 램프의 어둠·기본·밝음, 4: 다른 재질 */
export function palette(): Palette {
  let p = createPalette();
  for (const h of ['#402020', '#a03030', '#e06060', '#3050a0']) p = addColor(p, hexToRgba(h), h).palette;
  return p;
}

export function ctx(over: Partial<QaContext> = {}): QaContext {
  return {
    id: 't', palette: palette(), budget: 15, background: [0x2a, 0x22, 0x38], rules: RULES,
    rampOf: new Map([[1, { ramp: 'r', step: 0 }], [2, { ramp: 'r', step: 1 }], [3, { ramp: 'r', step: 2 }], [4, { ramp: 'b', step: 0 }]]),
    ...over,
  };
}

/** 문자 그리드 → 래스터 ('.' = 0, 숫자 = 인덱스) */
export function raster(rows: string[]): IndexedRaster {
  const w = rows[0]?.length ?? 0;
  const px = new Uint8Array(w * rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { px[y * w + x] = ch === '.' ? 0 : parseInt(ch, 36); }));
  return { w, h: rows.length, px };
}

export const frame = (rows: string[], extra: Partial<QaFrame> = {}): QaFrame => ({ name: 'rest', raster: raster(rows), ...extra });

/** 깨끗한 6×6: 가장자리 비고, 고립 픽셀 없음 */
export const CLEAN = ['......', '.2222.', '.2222.', '.2222.', '.2222.', '......'];
