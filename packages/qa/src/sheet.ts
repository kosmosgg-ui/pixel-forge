import { addColor, createIndexed, hexToRgba, type IndexedRaster, type Palette } from '@pixel-forge/core';
import type { Check, QaFrame } from './types.js';

export interface SheetOptions {
  /** rules.qa.sheetScale */
  scale: number;
  /** 바이블 배경 hex */
  background: string;
}

export interface Sheet {
  raster: IndexedRaster;
  /** 산출물 팔레트 + 시트 전용 색(체커 2색·배경·빨강). 산출물 팔레트와 분리된 사본 */
  palette: Palette;
}

const CHECKER = ['#c8c8c8', '#9a9a9a'] as const;
const RED = '#ff0000';
const MAX_MARKS = 64;

function extend(p: Palette, background: string): { palette: Palette; ids: [number, number, number, number] } {
  let palette = p;
  const ids = [...CHECKER, background, RED].map((hex) => {
    const r = addColor(palette, hexToRgba(hex), `qa:${hex}`);
    palette = r.palette;
    return r.index;
  });
  return { palette, ids: ids as [number, number, number, number] };
}

/**
 * 컨택트 시트(§9): 애니메이션별 1행, 프레임마다 체커 배경 칸 + 바이블 배경 칸 2벌을 scale배 최근접 확대.
 * 실패 검사의 where 위치는 두 칸 모두에 빨간 1px 테두리.
 */
export function contactSheet(rows: readonly (readonly QaFrame[])[], base: Palette, checks: readonly Check[], o: SheetOptions): Sheet {
  const { palette, ids } = extend(base, o.background);
  const [light, dark, bg, red] = ids;
  const k = o.scale;
  const fw = Math.max(1, ...rows.flat().map((f) => f.raster.w)) * k;
  const fh = Math.max(1, ...rows.flat().map((f) => f.raster.h)) * k;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const out = createIndexed(k + cols * 2 * (fw + k), k + rows.length * (fh + k));
  const marks = checks.filter((c) => !c.pass && c.where).flatMap((c) => (c.where ?? []).map((w) => ({ frame: c.frame ?? 0, x: w[0], y: w[1] }))).slice(0, MAX_MARKS);
  rows.forEach((row, ry) => row.forEach((f, fi) => {
    for (const cell of [0, 1]) {
      const ox = k + (fi * 2 + cell) * (fw + k), oy = k + ry * (fh + k);
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const v = f.raster.px[Math.floor(y / k) * f.raster.w + Math.floor(x / k)] ?? 0;
        const ground = cell === 1 ? bg : ((Math.floor(x / k) + Math.floor(y / k)) % 2 ? dark : light);
        out.px[(oy + y) * out.w + ox + x] = v || ground;
      }
      for (const m of marks) if (m.frame === fi) frameRect(out, ox + m.x * k - 1, oy + m.y * k - 1, k + 2, red);
    }
  }));
  return { raster: out, palette };
}

function frameRect(r: IndexedRaster, x0: number, y0: number, size: number, idx: number): void {
  for (let i = 0; i < size; i++) {
    for (const [x, y] of [[x0 + i, y0], [x0 + i, y0 + size - 1], [x0, y0 + i], [x0 + size - 1, y0 + i]] as const) {
      if (x >= 0 && y >= 0 && x < r.w && y < r.h) r.px[y * r.w + x] = idx;
    }
  }
}
