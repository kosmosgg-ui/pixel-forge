import type { RgbaImage } from '../io/png.js';
/** Approved Sera has no green material; preserve red/blue and alpha while removing key-green excess. */
export function seraDespillColor(rgb: number): number {
  const r = rgb >>> 16, g = (rgb >>> 8) & 255, b = rgb & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  // HSV 70..170 inclusive, S>.12, evaluated as integers to include exact 70/170 boundaries.
  const green = delta > 0 && g === max && Math.abs(6 * (b - r)) <= 5 * delta && 100 * delta > 12 * max;
  return green ? (r << 16) | (Math.max(r, b) << 8) | b : rgb;
}
export function seraDespillInPlace(image: RgbaImage): number {
  let changed = 0;
  for (let i = 0; i < image.rgba.length; i += 4) {
    if (!image.rgba[i + 3]) continue;
    const rgb = ((image.rgba[i] ?? 0) << 16) | ((image.rgba[i + 1] ?? 0) << 8) | (image.rgba[i + 2] ?? 0), fixed = seraDespillColor(rgb);
    if (fixed === rgb) continue;
    image.rgba[i + 1] = (fixed >>> 8) & 255; changed++;
  }
  return changed;
}
