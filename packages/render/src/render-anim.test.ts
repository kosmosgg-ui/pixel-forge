import { describe, expect, it } from 'vitest';
import { buildBiblePalette, equals } from '@pixel-forge/core';
import { animsFileSchema, bibleSchema, rigSchema, rulesSchema, specSchema } from '@pixel-forge/spec';
import animsJson from '../../../data/rigs/humanoid-34-v1.anims.json' with { type: 'json' };
import rigJson from '../../../data/rigs/humanoid-34-v1.rig.json' with { type: 'json' };
import bibleJson from '../../../data/bibles/sample-v0.bible.json' with { type: 'json' };
import rulesJson from '../../../data/rules/default.rules.json' with { type: 'json' };
import warriorJson from '../../../data/specs/sample/warrior.spec.json' with { type: 'json' };
import { mirrorFrame, renderAnimations } from './render-anim.js';
import type { RenderContext } from './render-frame.js';

const bible = bibleSchema.parse(bibleJson), rules = rulesSchema.parse(rulesJson);
const ctx: RenderContext = { spec: specSchema.parse(warriorJson), bible, rules, rig: rigSchema.parse(rigJson), palette: buildBiblePalette(bible, rules) };
const anims = animsFileSchema.parse(animsJson);
const out = renderAnimations(ctx, anims, ['idle', 'attack', 'hit', 'death']);
const bottom = (px: Uint8Array, w: number) => { for (let k = px.length - 1; k >= 0; k--) if (px[k]) return Math.floor(k / w); return -1; };

describe('renderAnimations', () => {
  it('프레임 수: idle 4, attack 5 + inbetween 1, hit 2, death 4', () => {
    const n = (id: string) => out.frames.filter((f) => f.anim === id).length;
    expect([n('idle'), n('attack'), n('hit'), n('death')]).toEqual([4, 6, 2, 4]);
  });

  it('root 고정 프레임은 rest와 발 최하단 y가 같다', () => {
    const y0 = bottom(out.rest.raster.px, out.rest.raster.w);
    const fixed = out.frames.filter((f) => f.rootFixed);
    expect(fixed.length).toBeGreaterThan(4);
    for (const f of fixed) expect(bottom(f.raster.px, f.raster.w)).toBe(y0);
  });

  it('색 예산은 전 프레임 합쳐서 ≤ 예산, 병합은 모든 프레임에 같게', () => {
    const used = new Set<number>();
    for (const r of [out.rest.raster, ...out.frames.map((f) => f.raster)]) for (const v of r.px) if (v) used.add(v);
    expect(used.size).toBeLessThanOrEqual(15);
    expect(out.frames.every((f) => f.meta.budget === out.budget)).toBe(true);
  });

  it('fx: strike 프레임에 베기 호(fx 색), flinch 프레임은 실루엣 전체가 fx 색', () => {
    const white = ctx.palette.fxIndices[0];
    const strike = out.frames.find((f) => f.keyName === 'strike' && !f.inbetween)!;
    expect(strike.raster.px.filter((v) => v === white).length).toBeGreaterThan(8);
    const flinch = out.frames.find((f) => f.keyName === 'flinch')!;
    expect(new Set(Array.from(flinch.raster.px).filter((v) => v))).toEqual(new Set([white]));
  });

  it('좌향은 우향의 픽셀 정확한 반전', () => {
    const r = out.frames[0]!.raster;
    expect(equals(mirrorFrame(mirrorFrame(r)), r)).toBe(true);
    expect(mirrorFrame(r).px[0]).toBe(r.px[r.w - 1]);
  });

  it('결정론: 같은 입력 2회 → 모든 프레임 픽셀 동일', () => {
    const again = renderAnimations(ctx, anims, ['idle', 'attack', 'hit', 'death']);
    again.frames.forEach((f, i) => expect(equals(f.raster, out.frames[i]!.raster)).toBe(true));
  });
});
