import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, pngChunks } from './png.js';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const img = () => {
  const rgba = new Uint8Array(4 * 3 * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([i * 5, 255 - i * 3, i * 7, i % 8 ? 255 : 0], i);
  return { w: 4, h: 3, rgba };
};

describe('png io', () => {
  it('같은 래스터 → 같은 SHA-256', () => {
    expect(sha(encodePng(img()))).toBe(sha(encodePng(img())));
  });

  it('메타데이터 청크 없이 IHDR, IDAT, IEND만', () => {
    const chunks = pngChunks(encodePng(img()));
    expect(chunks[0]).toBe('IHDR');
    expect(chunks[chunks.length - 1]).toBe('IEND');
    expect(new Set(chunks)).toEqual(new Set(['IHDR', 'IDAT', 'IEND']));
  });

  it('RGBA 8비트(colorType 6)로 쓰고 그대로 읽힌다', () => {
    const buf = encodePng(img());
    expect(buf[24]).toBe(8);
    expect(buf[25]).toBe(6);
    const back = decodePng(buf);
    expect([back.w, back.h]).toEqual([4, 3]);
    expect(Array.from(back.rgba)).toEqual(Array.from(img().rgba));
  });
});
