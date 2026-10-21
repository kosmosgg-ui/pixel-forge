export interface IndexedRaster {
  w: number;
  h: number;
  /** 팔레트 인덱스, 0 = 투명 */
  px: Uint8Array;
}

export function createIndexed(w: number, h: number): IndexedRaster {
  return { w, h, px: new Uint8Array(w * h) };
}

/** 경계 밖은 0(투명) */
export function getPx(r: IndexedRaster, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return 0;
  return r.px[y * r.w + x] ?? 0;
}

/** 경계 밖은 무시 */
export function setPxInPlace(r: IndexedRaster, x: number, y: number, index: number): void {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  r.px[y * r.w + x] = index;
}

/** src의 0(투명)은 건너뛴다. 경계 밖은 잘린다 */
export function blitInPlace(dst: IndexedRaster, src: IndexedRaster, x: number, y: number): void {
  for (let sy = 0; sy < src.h; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dst.h) continue;
    for (let sx = 0; sx < src.w; sx++) {
      const dx = x + sx;
      if (dx < 0 || dx >= dst.w) continue;
      const v = src.px[sy * src.w + sx] ?? 0;
      if (v !== 0) dst.px[dy * dst.w + dx] = v;
    }
  }
}

export function flipX(r: IndexedRaster): IndexedRaster {
  const out = createIndexed(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) out.px[y * r.w + x] = r.px[y * r.w + (r.w - 1 - x)] ?? 0;
  }
  return out;
}

/** 정수 배율 최근접 확대 (rule: 안티앨리어싱 금지) */
export function scaleNearest(r: IndexedRaster, k: number): IndexedRaster {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`배율은 1 이상의 정수여야 합니다: ${k}`);
  const out = createIndexed(r.w * k, r.h * k);
  for (let y = 0; y < out.h; y++) {
    const sy = Math.floor(y / k);
    for (let x = 0; x < out.w; x++) out.px[y * out.w + x] = r.px[sy * r.w + Math.floor(x / k)] ?? 0;
  }
  return out;
}

export function equals(a: IndexedRaster, b: IndexedRaster): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) return false;
  return true;
}
