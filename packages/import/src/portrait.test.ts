import { expect, it } from 'vitest';
import { normalizePortrait, portraitConsistency, portraitPanels } from './portrait.js';
function face(r: number) {
  const w = 100, h = 100, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.set(x >= 25 && x < 75 && y >= 10 && y < 90 ? [r, 60, 30, 255] : [0, 255, 0, 255], (y * w + x) * 4);
  return { w, h, rgba };
}
it('synthetic 2x2 splits TL/TR/BL/BR; removes green, centers and puts head at y40', () => {
  const rgba = new Uint8Array(200 * 200 * 4);
  [90, 110, 130, 150].forEach((r, i) => {
    const f = face(r);
    for (let y = 0; y < 100; y++) rgba.set(f.rgba.subarray(y * 400, (y + 1) * 400), (((i >> 1) * 100 + y) * 200 + i % 2 * 100) * 4);
  });
  const panels = portraitPanels({ w: 200, h: 200, rgba }, 4), normalized = panels.map(normalizePortrait);
  normalized.forEach((n, i) => {
    expect(n.qa).toMatchObject({ green: 0, headTop: 40, clipped: [], pass: true });
    expect(n.image.rgba[(40 * 720 + 360) * 4]).toBe([90, 110, 130, 150][i]);
    expect(n.image.rgba[(40 * 720 + 334) * 4 + 3]).toBe(0);
  });
  expect(portraitConsistency(normalized.map(n => n.qa.headWidthProxy))).toBe(0);
  expect(portraitConsistency([100, 109])).toBeGreaterThan(.08);
});
it('single illustration and two-panel receive paths preserve alpha and input bytes', () => {
  const f = face(120), before = new Uint8Array(f.rgba);
  expect(portraitPanels(f, 1)).toHaveLength(1);
  expect(portraitPanels(f, 2)).toHaveLength(2);
  normalizePortrait(f); expect(f.rgba).toEqual(before);
  expect(() => portraitPanels({ ...f, w: 99 }, 2)).toThrow();
});
it('clipped head/shoulder fails QA while enclosed reserved key-green is removed', () => {
  const f = face(120);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) f.rgba.set([120, 60, 30, 255], (y * 100 + x) * 4);
  // Transparent corners prevent generic keying from mistaking the entire foreground for a background.
  f.rgba[3] = 0;
  f.rgba.set([0, 255, 0, 255], (50 * 100 + 50) * 4);
  const n = normalizePortrait(f);
  expect(n.qa.pass).toBe(false); expect(n.qa.green).toBe(0);
  expect(n.qa.clipped).toContain('head/top'); expect(n.qa.clipped).toContain('shoulder/right');
});
