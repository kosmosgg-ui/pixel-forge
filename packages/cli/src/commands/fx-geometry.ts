import type { RgbaImage } from '../io/png.js';
/** Check exported sprites about their declared anchor, including all pre-rasterized directions. */
export function slashGeometry(image: RgbaImage, cell: readonly [number, number], anchor: readonly [number, number], reach: number, angle: number) {
  const [w, h] = cell, [ax, ay] = anchor;
  const rows = [];
  for (let row = 0; row < 8; row++) for (let frame = 0; frame < 3; frame++) {
    let radius = 0, lo = Infinity, hi = -Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!image.rgba[((row * h + y) * image.w + frame * w + x) * 4 + 3]) continue;
      const dx = x - ax, dy = y - ay, a = ((Math.atan2(dy, dx) * 180 / Math.PI - row * 45 + 540) % 360) - 180;
      radius = Math.max(radius, Math.hypot(dx, dy)); lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    const ratio = radius / (reach / 3), angleError = frame === 0 ? Math.max(Math.abs(lo + angle / 2), Math.abs(hi - angle / 2)) : 0;
    const centerTransparent = image.rgba[((row * h + ay) * image.w + frame * w + ax) * 4 + 3] === 0;
    rows.push({ row, frame, radius, ratio, angleError, centerTransparent, pass: ratio >= .9 && ratio <= 1 && angleError <= 5 && centerTransparent });
  }
  return rows;
}
