import { ForgeError } from '@pixel-forge/core';
import type { RgbaImage } from './types.js';
import { removeBackgroundInPlace, despillEdgesInPlace } from './background.js';

export function portraitPanels(source: RgbaImage, count: 1 | 2 | 4): RgbaImage[] {
  const cols = count === 1 ? 1 : 2, rows = count === 4 ? 2 : 1;
  if (source.w % cols || source.h % rows) throw new ForgeError('portrait.grid', 'Equal portrait panels required');
  const w = source.w / cols, h = source.h / rows;
  return Array.from({ length: count }, (_, i) => {
    const rgba = new Uint8Array(w * h * 4), ox = i % cols * w, oy = Math.floor(i / cols) * h;
    for (let y = 0; y < h; y++) rgba.set(source.rgba.subarray(((oy + y) * source.w + ox) * 4, ((oy + y) * source.w + ox + w) * 4), y * w * 4);
    return { w, h, rgba };
  });
}
function bounds(img: RgbaImage) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.rgba[(y * img.w + x) * 4 + 3]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new ForgeError('portrait.empty', 'Portrait contains no foreground');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// Portraits are the approved illustration exception: premultiplied bilinear, never pixel quantization.
function sample(img: RgbaImage, x: number, y: number): number[] {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, value = [0, 0, 0, 0];
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const sx = Math.max(0, Math.min(img.w - 1, ix + dx)), sy = Math.max(0, Math.min(img.h - 1, iy + dy));
    const at = (sy * img.w + sx) * 4, weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy), a = (img.rgba[at + 3] ?? 0) / 255;
    value[3] = (value[3] ?? 0) + a * weight;
    for (let c = 0; c < 3; c++) value[c] = (value[c] ?? 0) + (img.rgba[at + c] ?? 0) * a * weight;
  }
  const a = value[3] ?? 0;
  return [Math.round((value[0] ?? 0) / (a || 1)), Math.round((value[1] ?? 0) / (a || 1)), Math.round((value[2] ?? 0) / (a || 1)), Math.round(a * 255)];
}
export function normalizePortrait(source: RgbaImage) {
  const img = { ...source, rgba: new Uint8Array(source.rgba) };
  removeBackgroundInPlace(img);
  // Portrait references reserve key-green for background, including holes enclosed by hair/arms.
  for (let i = 0; i < img.rgba.length; i += 4) if ((img.rgba[i] ?? 0) <= 64 && (img.rgba[i + 2] ?? 0) <= 64 && (img.rgba[i + 1] ?? 0) > Math.max(img.rgba[i] ?? 0, img.rgba[i + 2] ?? 0) + 40) img.rgba[i + 3] = 0;
  despillEdgesInPlace(img, [0, 255, 0], 2);
  const b = bounds(img), scale = Math.min(1, 680 / b.h, 680 / b.w), w = Math.max(1, Math.floor(b.w * scale)), h = Math.max(1, Math.floor(b.h * scale));
  const out = { w: 720, h: 720, rgba: new Uint8Array(720 * 720 * 4) }, left = Math.floor((720 - w) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.rgba.set(sample(img, b.x0 + (x + .5) / scale - .5, b.y0 + (y + .5) / scale - .5), ((40 + y) * 720 + left + x) * 4);
  despillEdgesInPlace(out, [0, 255, 0], 2);
  const edges = [b.y0 === 0 ? 'head/top' : '', b.x0 === 0 ? 'shoulder/left' : '', b.x1 === img.w - 1 ? 'shoulder/right' : ''].filter(Boolean);
  let green = 0, headMin = 720, headMax = -1;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const k = (y * out.w + x) * 4;
    if (!out.rgba[k + 3]) continue;
    if ((out.rgba[k + 1] ?? 0) > Math.max(out.rgba[k] ?? 0, out.rgba[k + 2] ?? 0) + 40) green++;
    if (y < 40 + h * .25) { headMin = Math.min(headMin, x); headMax = Math.max(headMax, x); }
  }
  return { image: out, qa: { green, clipped: edges, headWidthProxy: headMax - headMin + 1, headTop: bounds(out).y0, scale, pass: green === 0 && edges.length === 0 } };
}
export function portraitConsistency(widths: number[]): number {
  return widths.length ? (Math.max(...widths) - Math.min(...widths)) / Math.max(...widths) : 0;
}
