import type { BiblePalette } from './color/bible-palette.js';
import { srgbToOklab } from './color/oklab.js';
import { createIndexed, type IndexedRaster } from './raster.js';

export interface PaletteSheetOptions {
  /** 견본 한 칸 크기(px), 테두리 표시를 위해 3 이상 */
  swatch: number;
  /** 칸 사이 투명 간격(px) */
  gap: number;
}

/** 가장 밝은 팔레트 색: 외곽선 톤 칸 테두리용 */
function lightestIndex(bp: BiblePalette): number {
  let best = 1, bestL = -1;
  for (let i = 1; i < bp.palette.colors.length; i++) {
    const c = bp.palette.colors[i] ?? 0;
    const L = srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255).L;
    if (L > bestL) { bestL = L; best = i; }
  }
  return best;
}

function fillSwatch(out: IndexedRaster, x: number, y: number, size: number, idx: number, frame?: number): void {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
    const edge = dx === 0 || dy === 0 || dx === size - 1 || dy === size - 1;
    out.px[(y + dy) * out.w + x + dx] = frame !== undefined && edge ? frame : idx;
  }
}

/**
 * 재질 행(키 정렬): 맨 왼쪽은 외곽선 톤(테두리), 한 칸 띄우고 램프 어두움→밝음.
 * 아래에 전역 외곽선 행과 이펙트 행(램프 열에 맞춤).
 */
export function paletteSheet(bp: BiblePalette, { swatch, gap }: PaletteSheetOptions): IndexedRaster {
  const keys = Object.keys(bp.ramps).sort();
  const extra: number[][] = [[bp.outlineIndex]];
  if (bp.fxIndices.length) extra.push(bp.fxIndices);
  const cell = swatch + gap;
  const rampX = gap + cell + gap;
  const cols = Math.max(...keys.map((k) => bp.ramps[k]?.indices.length ?? 0), ...extra.map((r) => r.length));
  const out = createIndexed(rampX + cols * cell, gap + (keys.length + extra.length) * cell);
  const frame = lightestIndex(bp);
  keys.forEach((k, ry) => {
    const ramp = bp.ramps[k];
    if (!ramp) return;
    const y = gap + ry * cell;
    fillSwatch(out, gap, y, swatch, ramp.outline, frame);
    ramp.indices.forEach((idx, cx) => fillSwatch(out, rampX + cx * cell, y, swatch, idx));
  });
  extra.forEach((row, i) => row.forEach((idx, cx) => fillSwatch(out, rampX + cx * cell, gap + (keys.length + i) * cell, swatch, idx)));
  return out;
}
