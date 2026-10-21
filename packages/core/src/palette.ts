import { ForgeError } from './errors.js';
import type { IndexedRaster } from './raster.js';

export interface Palette {
  /** 0xRRGGBBAA. 인덱스 0은 항상 투명 */
  colors: Uint32Array;
  names: string[];
}

export const TRANSPARENT_INDEX = 0;
const MAX_COLORS = 256;

export function createPalette(): Palette {
  return { colors: Uint32Array.of(0), names: ['transparent'] };
}

export function findColor(p: Palette, rgba: number): number {
  for (let i = 1; i < p.colors.length; i++) if (p.colors[i] === rgba >>> 0) return i;
  return -1;
}

/** 같은 색이 이미 있으면 그 인덱스를 돌려주고 팔레트는 그대로 */
export function addColor(p: Palette, rgba: number, name: string): { palette: Palette; index: number } {
  if ((rgba & 255) !== 255) throw new ForgeError('palette.alpha', '팔레트 색은 불투명이어야 합니다', { rgba });
  const found = findColor(p, rgba);
  if (found >= 0) return { palette: p, index: found };
  if (p.colors.length >= MAX_COLORS) throw new ForgeError('palette.full', `팔레트는 최대 ${MAX_COLORS - 1}색입니다`);
  const colors = new Uint32Array(p.colors.length + 1);
  colors.set(p.colors);
  colors[p.colors.length] = rgba >>> 0;
  return { palette: { colors, names: [...p.names, name] }, index: p.colors.length };
}

/** io/export 전용. 알파는 0 또는 255만 나온다 */
export function toRGBA(r: IndexedRaster, p: Palette): Uint8Array {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let i = 0; i < r.px.length; i++) {
    const idx = r.px[i] ?? 0;
    if (idx === TRANSPARENT_INDEX) continue;
    const c = p.colors[idx];
    if (c === undefined) throw new ForgeError('palette.conformance', `팔레트 밖 인덱스: ${idx}`, { pixel: i });
    out[i * 4] = c >>> 24;
    out[i * 4 + 1] = (c >>> 16) & 255;
    out[i * 4 + 2] = (c >>> 8) & 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}
