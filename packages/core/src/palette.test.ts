import { describe, expect, it } from 'vitest';
import { ForgeError } from './errors.js';
import { addColor, createPalette, toRGBA } from './palette.js';
import { hexToRgba } from './color/hex.js';

describe('palette', () => {
  it('인덱스 0은 투명이고 같은 색은 인덱스를 공유한다', () => {
    const p0 = createPalette();
    expect(p0.colors[0]).toBe(0);
    const a = addColor(p0, hexToRgba('#ff0000'), 'red');
    const b = addColor(a.palette, hexToRgba('#ff0000'), 'red2');
    expect(a.index).toBe(1);
    expect(b.index).toBe(1);
    expect(b.palette.colors.length).toBe(2);
  });

  it('toRGBA 알파는 0 또는 255만', () => {
    const { palette } = addColor(createPalette(), hexToRgba('#336699'), 'c');
    const rgba = toRGBA({ w: 2, h: 1, px: Uint8Array.from([0, 1]) }, palette);
    expect(Array.from(rgba)).toEqual([0, 0, 0, 0, 0x33, 0x66, 0x99, 255]);
    for (let i = 3; i < rgba.length; i += 4) expect([0, 255]).toContain(rgba[i]);
  });

  it('팔레트 밖 인덱스는 ForgeError', () => {
    expect(() => toRGBA({ w: 1, h: 1, px: Uint8Array.of(7) }, createPalette())).toThrow(ForgeError);
  });
});
