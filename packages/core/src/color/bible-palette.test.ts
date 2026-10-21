import { describe, expect, it } from 'vitest';
import type { BibleColors, RulesColor } from '@pixel-forge/spec';
import { buildBiblePalette } from './bible-palette.js';

const rules: RulesColor = {
  ramp: { id: 'r', steps: 5, deltaL: 0.11, hueShift: 8, warmHue: 70, coolHue: 260, chromaFalloff: 0.25 },
  materialContrast: { default: 1, metal: 1.4 },
};
const bible: BibleColors = {
  id: 't',
  materials: {
    zeta: { base: '#8c95a6', steps: 5, kind: 'metal' },
    alpha: { base: '#a83c3c', steps: 4, kind: 'cloth' },
    alpha_copy: { base: '#a83c3c', steps: 4, kind: 'cloth' },
  },
  outline: { globalColor: '#1a1020' },
  fxColors: ['#ffffff', '#1a1020'],
};

describe('buildBiblePalette', () => {
  it('재질 키 정렬 순서로 인덱스를 매기고 0은 투명', () => {
    const bp = buildBiblePalette(bible, rules);
    expect(bp.palette.colors[0]).toBe(0);
    expect(bp.ramps.alpha?.indices).toEqual([1, 2, 3, 4]);
  });

  it('같은 hex는 재질이 달라도 인덱스를 공유한다', () => {
    const bp = buildBiblePalette(bible, rules);
    expect(bp.ramps.alpha_copy?.indices).toEqual(bp.ramps.alpha?.indices);
    expect(bp.fxIndices[1]).toBe(bp.outlineIndex);
  });

  it('결정론: 2회 결과 동일', () => {
    const a = buildBiblePalette(bible, rules);
    const b = buildBiblePalette(bible, rules);
    expect(Array.from(a.palette.colors)).toEqual(Array.from(b.palette.colors));
    expect(a.ramps).toEqual(b.ramps);
  });
});
