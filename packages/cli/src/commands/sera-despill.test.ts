import { expect, it } from 'vitest';
import { seraDespillColor, seraDespillInPlace } from './sera-despill.js';
it('Sera-specific pre-palette despill preserves alpha and non-green channels; protects brown/blue and transparent pixels', () => {
  const image = { w: 4, h: 1, rgba: new Uint8Array([83,93,56,255, 140,80,40,255, 30,70,180,255, 0,255,0,0]) };
  expect(seraDespillInPlace(image)).toBe(1);
  expect([...image.rgba]).toEqual([83,83,56,255,140,80,40,255,30,70,180,255,0,255,0,0]);
  expect(seraDespillColor(0x535d38)).toBe(0x535338);
  expect(seraDespillColor(seraDespillColor(0x535d38))).toBe(0x535338);
});
