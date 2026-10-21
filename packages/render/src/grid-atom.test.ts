import { describe, expect, it } from 'vitest';
import { SPECIAL_EYE, SPECIAL_EYE_COLOR, SPECIAL_OUTLINE } from '@pixel-forge/core';
import { partSchema, type GridShape } from '@pixel-forge/spec';
import { gridToMask, pickAtom } from './grid-atom.js';

const arm: GridShape = { type: 'grid', rows: ['aaaa', 'AAAA'], legend: { a: 'm:2', A: 'm:1' }, origin: [0, 0] };
const diag: GridShape = { type: 'grid', rows: ['a...', '.a..', '..a.', '...a'], legend: { a: 'm:3' }, origin: [0, 0] };
const part = (over: Record<string, unknown> = {}) => partSchema.parse({ bone: 'b', shape: arm, ...over });

describe('그리드 아톰', () => {
  it('범례: 재질:단계는 고정 단계, @eye는 검은 눈, @eye:재질:단계는 색 눈, @outline은 외곽선 강제', () => {
    const g = gridToMask({ rows: ['ae', 'Eo'], legend: { a: 'm:2', e: '@eye', E: '@eye:m:3', o: '@outline' } });
    expect(Array.from(g.shade)).toEqual([2, 0, 3, 0]);
    expect(Array.from(g.special)).toEqual([0, SPECIAL_EYE, SPECIAL_EYE_COLOR, SPECIAL_OUTLINE]);
    expect(g.materials).toEqual(['m']);
  });

  it('가장 가까운 각도 변형을 고르고 남은 각도만 RotSprite — 45° 근처는 그린 45° 변형 그대로', () => {
    const p = part({ variants: { 45: diag } });
    const at45 = pickAtom(p, arm, 45);
    expect(at45.grid.w).toBe(4);
    expect(at45.grid.h).toBe(4);
    expect(at45.warning).toBeUndefined();
    expect(Array.from(pickAtom(p, arm, 0).grid.mask)).toEqual(Array.from(gridToMask(arm).mask));
  });

  it('변형이 없으면 전체 RotSprite + 경고, upright(머리)는 ±15° 안이면 돌리지 않고 1px 이동', () => {
    expect(pickAtom(part(), arm, 60).warning).toContain('RotSprite');
    const head = part({ upright: true });
    const tilt = pickAtom(head, arm, 12);
    expect(tilt.dx).toBe(1);
    expect(Array.from(tilt.grid.mask)).toEqual(Array.from(gridToMask(arm).mask));
    expect(pickAtom(head, arm, -3).dx).toBe(0);
  });
});
