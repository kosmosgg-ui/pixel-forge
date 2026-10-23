import type { RgbaImage } from '../io/png.js';
/** Approved Sera has no green material; preserve red/blue and alpha while removing key-green excess. */
export function seraDespillColor(rgb: number): number {
  const r = rgb >>> 16, g = (rgb >>> 8) & 255, b = rgb & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 * 60 : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60;
  return hue >= 70 && hue <= 170 && delta / Math.max(1, max) > .12 ? (r << 16) | (Math.max(r, b) << 8) | b : rgb;
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
