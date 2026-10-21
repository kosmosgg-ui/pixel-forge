import type { BiblePalette } from './color/bible-palette.js';
import { createIndexed, type IndexedRaster } from './raster.js';

export interface PaletteSheetOptions {
  /** 견본 한 칸 크기(px) */
  swatch: number;
  /** 칸 사이 투명 간격(px) */
  gap: number;
}

/** 행 = 재질 램프(키 정렬, 어두움→밝음), 마지막에 외곽선 행과 이펙트 행 */
export function paletteSheet(bp: BiblePalette, { swatch, gap }: PaletteSheetOptions): IndexedRaster {
  const rows: number[][] = Object.keys(bp.ramps).sort().map((k) => bp.ramps[k]?.indices ?? []);
  rows.push([bp.outlineIndex]);
  if (bp.fxIndices.length) rows.push(bp.fxIndices);
  const cols = Math.max(...rows.map((r) => r.length));
  const cell = swatch + gap;
  const out = createIndexed(gap + cols * cell, gap + rows.length * cell);
  rows.forEach((row, ry) => row.forEach((idx, cx) => {
    for (let y = 0; y < swatch; y++) {
      const base = (gap + ry * cell + y) * out.w + gap + cx * cell;
      out.px.fill(idx, base, base + swatch);
    }
  }));
  return out;
}
