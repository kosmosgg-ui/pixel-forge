import { describe, expect, it } from 'vitest';
import type { BibleColors } from '@pixel-forge/spec';
import { ForgeError } from '../errors.js';
import { buildBiblePalette } from './bible-palette.js';
import { toHex } from './hex.js';
import { oklchToSrgbInGamut, srgbToOklab } from './oklab.js';
import { RULES as rules } from './test-rules.js';

const mat = (base: string, steps: number, kind = 'cloth', extra: object = {}) => ({ base, steps, kind, ...extra });
const bible = (materials: BibleColors['materials'], fxColors: string[] = ['#ffffff']): BibleColors =>
  ({ id: 't', materials, outline: { globalColor: '#1a1020' }, fxColors });
const labOf = (bp: ReturnType<typeof buildBiblePalette>, i: number) => {
  const c = bp.palette.colors[i] ?? 0;
  return srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255);
};
const d = (a: ReturnType<typeof labOf>, b: ReturnType<typeof labOf>) => Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);

const SAMPLE = {
  skin: mat('#d9a07a', 4, 'skin'), hair_brown: mat('#5a3a2a', 3), cloth_red: mat('#a83c3c', 4), cloth_green: mat('#3f7a4a', 4),
  cloth_blue: mat('#3c5aa8', 4), cloth_white: mat('#d8d2c4', 3), cloth_purple: mat('#6a3c8c', 4), leather: mat('#6b4a32', 4, 'default'),
  metal: mat('#8c95a6', 5, 'metal'), gold: mat('#c9a23a', 4, 'metal'), wood: mat('#7a5634', 3, 'default', { shareWith: 'leather' }), goblin_skin: mat('#7f9a3c', 4, 'skin'),
};

describe('buildBiblePalette', () => {
  it('재질 키 정렬 순서, 램프 다음에 그 재질 외곽선 톤, 0은 투명', () => {
    const bp = buildBiblePalette(bible({ zeta: mat('#8c95a6', 5, 'metal'), alpha: mat('#a83c3c', 4) }), rules);
    expect(bp.palette.colors[0]).toBe(0);
    expect(bp.ramps.alpha).toEqual({ id: 'alpha', indices: [1, 2, 3, 4], outline: 5 });
  });

  it('모든 재질 색은 예약 색·서로와 OKLab 거리 ≥ 0.03, 램프 명도는 엄격히 증가', () => {
    const bp = buildBiblePalette(bible(SAMPLE, ['#ffffff', '#ffe08a', '#ff6a3c']), rules);
    const owner = new Map<number, string>();
    for (const r of Object.values(bp.ramps)) for (const i of [...r.indices, r.outline]) owner.set(i, r.id);
    const shared = (a?: string, b?: string) => a === 'wood' && b === 'leather' || a === 'leather' && b === 'wood';
    const all = [...owner.keys(), bp.outlineIndex, ...bp.fxIndices];
    for (const a of owner.keys()) for (const b of all) {
      if (a !== b && !shared(owner.get(a), owner.get(b))) expect(d(labOf(bp, a), labOf(bp, b))).toBeGreaterThanOrEqual(0.03);
    }
    for (const r of Object.values(bp.ramps)) {
      const Ls = r.indices.map((i) => labOf(bp, i).L);
      for (let i = 1; i < Ls.length; i++) expect(Ls[i]).toBeGreaterThan(Ls[i - 1] ?? 0);
    }
  });

  it('shareWith가 있으면 같은 hex는 인덱스를 공유한다', () => {
    const bp = buildBiblePalette(bible({ metal: mat('#8c95a6', 3), trim: mat('#8c95a6', 3, 'cloth', { shareWith: 'metal' }) }), rules);
    expect(bp.ramps.trim?.indices).toEqual(bp.ramps.metal?.indices);
  });

  it('shareWith 없이 같은 기준색을 두 재질에 쓰면 palette.collision', () => {
    expect(() => buildBiblePalette(bible({ a: mat('#8c95a6', 3), b: mat('#8c95a6', 3) }), rules)).toThrow(/b\[/);
  });

  it('조금만 겹치면 L을 밀어 서로 다른 색으로 만든다', () => {
    const bp = buildBiblePalette(bible({ a: mat('#a83c3c', 3), b: mat('#ad4038', 3) }), rules);
    expect(bp.ramps.a?.indices.some((i) => bp.ramps.b?.indices.includes(i))).toBe(false);
  });

  it('피할 곳이 없으면 palette.collision (재질·단계 포함)', () => {
    const grays = Array.from({ length: 31 }, (_, i) => toHex(...oklchToSrgbInGamut({ L: 0.3 + i * 0.015, C: 0, h: 0 })));
    try {
      buildBiblePalette(bible({ g: mat('#777777', 2) }, grays), rules);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ForgeError);
      expect((e as ForgeError).code).toBe('palette.collision');
      expect((e as ForgeError).detail).toMatchObject({ material: 'g' });
    }
  });

  it('밀다가 같은 램프 이웃 단계를 넘게 되면 palette.collision (명도 순서 유지)', () => {
    expect(() => buildBiblePalette(bible({ w: mat('#d8d2c4', 4) }), rules)).toThrow(/명도 순서/);
  });

  it('결정론: 2회 결과 동일', () => {
    const a = buildBiblePalette(bible(SAMPLE), rules);
    const b = buildBiblePalette(bible(SAMPLE), rules);
    expect(Array.from(a.palette.colors)).toEqual(Array.from(b.palette.colors));
    expect(a.ramps).toEqual(b.ramps);
  });
});
