import type { BibleColors, RulesColor } from '@pixel-forge/spec';
import { addColor, createPalette, type Palette } from '../palette.js';
import { hexToRgba } from './hex.js';
import { makeRamp, type Ramp } from './ramp.js';

export interface BiblePalette {
  palette: Palette;
  ramps: Record<string, Ramp>;
  outlineIndex: number;
  fxIndices: number[];
}

/** 순서: 재질 키 정렬 → 각 램프 어두움→밝음 → 외곽선 → 이펙트. 같은 hex는 인덱스를 공유한다 */
export function buildBiblePalette(bible: BibleColors, rules: RulesColor): BiblePalette {
  let palette = createPalette();
  const add = (hex: string, name: string): number => {
    const r = addColor(palette, hexToRgba(hex), name);
    palette = r.palette;
    return r.index;
  };
  const ramps: Record<string, Ramp> = {};
  for (const id of Object.keys(bible.materials).sort()) {
    const m = bible.materials[id];
    if (!m) continue;
    const contrast = m.contrast ?? rules.materialContrast[m.kind] ?? rules.materialContrast.default;
    const hexes = makeRamp(m.base, m.steps, contrast, rules.ramp);
    ramps[id] = { id, indices: hexes.map((h, i) => add(h, `${id}.${i}`)) };
  }
  const outlineIndex = add(bible.outline.globalColor, 'outline');
  const fxIndices = bible.fxColors.map((h, i) => add(h, `fx.${i}`));
  return { palette, ramps, outlineIndex, fxIndices };
}
