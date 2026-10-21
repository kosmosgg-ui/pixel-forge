export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m?.[1]) throw new RangeError(`hex 형식이 아닙니다: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 반올림 후 0~255 클램프 */
export function toHex(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** 0xRRGGBBAA */
export function packRgba(r: number, g: number, b: number, a: number): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

export function hexToRgba(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return packRgba(r, g, b, 255);
}
