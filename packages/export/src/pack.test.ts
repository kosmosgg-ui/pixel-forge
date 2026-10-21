import { describe, expect, it } from 'vitest';
import { createIndexed, createPalette, addColor } from '@pixel-forge/core';
import { packCharacter, type PackFrame } from './pack.js';

const frame = (anim: string, index: number, ms: number): PackFrame => {
  const r = createIndexed(8, 8);
  r.px[7 * 8 + 3] = 1;
  return { anim, index, raster: r, ms };
};
const pal = addColor(createPalette(), 0xff0000ff, 'red').palette;
const frames = [...[0, 1, 2, 3].map((i) => frame('idle', i, 180)), ...[0, 1, 2].map((i) => frame('hit', i, 60 + i))];
const input = { id: 'x', bible: 'b', sizeClass: 's', rest: frame('rest', 0, 0).raster, rootX: 4, frames, loops: { idle: true, hit: false }, motion: { bob: 1 }, palette: pal, version: '0.0.0' };

describe('packCharacter', () => {
  const r = packCharacter(input, 'x.png');

  it('frameTags 범위가 애니 프레임 수와 일치, 이름 <anim>_<dir>_<n>', () => {
    const tags = r.json.meta.frameTags;
    expect(tags.map((t) => [t.name, t.to - t.from + 1])).toEqual([['rest_r', 1], ['idle_r', 4], ['hit_r', 3]]);
    expect(Object.keys(r.json.frames)).toEqual(['rest_r_0', 'idle_r_0', 'idle_r_1', 'idle_r_2', 'idle_r_3', 'hit_r_0', 'hit_r_1', 'hit_r_2']);
    expect(tags.find((t) => t.name === 'hit_r')?.repeat).toBe('1');
    expect(tags.find((t) => t.name === 'idle_r')?.repeat).toBeUndefined();
    expect(r.json.frames['hit_r_2']?.duration).toBe(62);
    expect(r.json.meta.size).toEqual({ w: r.sheet.w, h: r.sheet.h });
  });

  it('manifest: 애니별 프레임·ms·loop, 발밑 기준점, 쓰인 색', () => {
    expect(r.manifest.anims['idle']).toEqual({ frames: ['idle_r_0', 'idle_r_1', 'idle_r_2', 'idle_r_3'], ms: [180, 180, 180, 180], loop: true });
    expect(r.manifest.anims['hit']?.loop).toBe(false);
    expect(r.manifest.pivot).toEqual([4, 8]);
    expect(r.manifest.palette).toEqual(['#ff0000']);
  });
});
