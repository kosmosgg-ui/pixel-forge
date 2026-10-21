import { addColor, createIndexed, hexToRgba, type IndexedRaster, type Palette } from '@pixel-forge/core';

export interface ReviewOptions {
  /** rules.qa.sheetScale */
  scale: number;
  /** 바이블 배경 hex — 게임 화면과 같은 바탕에서 판독하게 */
  background: string;
}

export interface ReviewSheet {
  raster: IndexedRaster;
  /** 산출물 팔레트 + 배경색 */
  palette: Palette;
  /** 칸 크기(확대 후)·열 수 */
  cell: [number, number];
  cols: number;
}

/**
 * 시각 검수 시트: 캐릭터마다 애니(rest 포함) 묶음을 순서대로 줄에 채운다. 한 줄 칸 수는 가장 긴 애니 길이 —
 * 넓은 1장은 이미지 판독 시 축소돼 1px 디테일이 사라지므로 폭을 줄인다. 묶음 사이 반 칸, 캐릭터 사이 한 칸 띄움.
 * pixel-reviewer와 보고 문서가 같은 1장을 보게 고정한 형식(체커·실패 표시 없음 — 판독만).
 */
export function reviewSheet(characters: readonly (readonly (readonly IndexedRaster[])[])[], base: Palette, o: ReviewOptions): ReviewSheet {
  const { palette, index: bg } = addColor(base, hexToRgba(o.background), `review:${o.background}`);
  const k = o.scale;
  const all = characters.flat(2);
  const fw = Math.max(1, ...all.map((r) => r.w)) * k, fh = Math.max(1, ...all.map((r) => r.h)) * k;
  const gap = k, groupGap = Math.floor(fw / 2);
  const cols = Math.max(1, ...characters.flat().map((g) => g.length));
  const lines = characters.map((groups) => packLines(groups, cols));
  const lineW = (line: readonly (readonly IndexedRaster[])[]) => line.reduce((a, g) => a + g.length * (fw + gap), 0) + (line.length - 1) * groupGap;
  const width = gap + Math.max(1, ...lines.flat().map(lineW));
  const height = gap + lines.reduce((a, l) => a + l.length * (fh + gap), 0) + Math.max(0, lines.length - 1) * fh;
  const out = createIndexed(width, height);
  out.px.fill(bg);
  let oy = gap;
  for (const charLines of lines) {
    for (const line of charLines) {
      let ox = gap;
      for (const g of line) {
        for (const f of g) { blitScaledInPlace(out, f, ox, oy, k); ox += fw + gap; }
        ox += groupGap;
      }
      oy += fh + gap;
    }
    oy += fh;
  }
  return { raster: out, palette, cell: [fw, fh], cols };
}

/** 묶음을 순서대로 한 줄 cols칸 안에 채운다(묶음은 쪼개지 않는다) */
function packLines<T>(groups: readonly (readonly T[])[], cols: number): (readonly T[])[][] {
  const lines: (readonly T[])[][] = [];
  let cur: (readonly T[])[] = [], used = 0;
  for (const g of groups) {
    if (cur.length && used + g.length > cols) { lines.push(cur); cur = []; used = 0; }
    cur.push(g);
    used += g.length;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function blitScaledInPlace(out: IndexedRaster, f: IndexedRaster, ox: number, oy: number, k: number): void {
  for (let y = 0; y < f.h * k; y++) for (let x = 0; x < f.w * k; x++) {
    const v = f.px[Math.floor(y / k) * f.w + Math.floor(x / k)] ?? 0;
    if (v) out.px[(oy + y) * out.w + ox + x] = v;
  }
}
