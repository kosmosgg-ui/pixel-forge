import { addColor, blitInPlace, createIndexed, createPrng, flipX, hexToRgba, type IndexedRaster, type Palette } from '@pixel-forge/core';

export interface CrowdOptions {
  /** 시트 크기(px) — 보통 bible.internalResolution(실제 게임 화면 1배) */
  w: number;
  h: number;
  count: number;
  seed: number;
  /** 바이블 배경 hex */
  background: string;
}

export interface CrowdSheet {
  raster: IndexedRaster;
  /** 스프라이트 팔레트 + 배경색. 산출물 팔레트와 분리된 사본 */
  palette: Palette;
  /** 놓인 순서대로 [스프라이트 순번, x, y, 좌우 반전] */
  placements: [number, number, number, boolean][];
}

/**
 * crowd.readability(§1 원칙 6) 시트: 바이블 배경 위에 스프라이트를 실제 크기로 시드 PRNG 무작위 배치.
 * 아래에 있는(발밑 y가 큰) 것이 앞에 그려지도록 y 순으로 덮는다. 모든 스프라이트가 시트 안에 들어간다.
 */
export function crowdSheet(sprites: readonly IndexedRaster[], base: Palette, o: CrowdOptions): CrowdSheet {
  const bg = addColor(base, hexToRgba(o.background), 'qa:crowd-bg');
  const out = createIndexed(o.w, o.h);
  out.px.fill(bg.index);
  const rng = createPrng(o.seed);
  const placements: [number, number, number, boolean][] = [];
  for (let i = 0; i < o.count && sprites.length; i++) {
    const s = rng.int(0, sprites.length - 1);
    const r = sprites[s];
    if (!r) continue;
    const flip = rng.next() < 0.5;
    placements.push([s, rng.int(0, Math.max(0, o.w - r.w)), rng.int(0, Math.max(0, o.h - r.h)), flip]);
  }
  const order = placements.map((p, i) => ({ p, i, foot: p[2] + (sprites[p[0]]?.h ?? 0) })).sort((a, b) => a.foot - b.foot || a.i - b.i);
  for (const { p: [s, x, y, flip] } of order) {
    const r = sprites[s];
    if (r) blitInPlace(out, flip ? flipX(r) : r, x, y);
  }
  return { raster: out, palette: bg.palette, placements };
}
