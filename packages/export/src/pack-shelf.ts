import { blitInPlace, createIndexed, type IndexedRaster } from '@pixel-forge/core';

export interface PackItem {
  name: string;
  raster: IndexedRaster;
}

export interface PackedRect {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackOptions {
  /** 프레임 둘레 빈 칸(px) — 엔진의 최근접 샘플링이 옆 프레임을 끌어오지 않게 */
  padding?: number;
  /** 시트 가로·세로를 2의 거듭제곱으로 올림(오래된 GPU·일부 엔진용) */
  pow2?: boolean;
}

export interface Packed {
  sheet: IndexedRaster;
  rects: PackedRect[];
}

const nextPow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };

/**
 * shelf 패킹(§10): 입력 순서 그대로(애니 순서 = 결정론) 왼쪽→오른쪽으로 채우고, 폭을 넘으면 새 선반.
 * 폭 = 전체 면적의 제곱근(최소 가장 넓은 프레임) — 정사각형에 가까운 시트. 같은 입력 → 같은 배치·크기.
 */
export function packShelf(items: readonly PackItem[], o: PackOptions = {}): Packed {
  const pad = o.padding ?? 1;
  const area = items.reduce((a, it) => a + (it.raster.w + pad) * (it.raster.h + pad), 0);
  const widest = Math.max(1, ...items.map((it) => it.raster.w + pad));
  const limit = Math.max(widest, Math.ceil(Math.sqrt(area))) + pad;
  const rects: PackedRect[] = [];
  let x = pad, y = pad, shelfH = 0, usedW = 0;
  for (const it of items) {
    const { w, h } = it.raster;
    if (x > pad && x + w + pad > limit) { x = pad; y += shelfH + pad; shelfH = 0; }
    rects.push({ name: it.name, x, y, w, h });
    x += w + pad;
    usedW = Math.max(usedW, x);
    shelfH = Math.max(shelfH, h);
  }
  const W = Math.max(1, usedW), H = Math.max(1, y + shelfH + pad);
  const sheet = createIndexed(o.pow2 ? nextPow2(W) : W, o.pow2 ? nextPow2(H) : H);
  items.forEach((it, i) => { const r = rects[i]; if (r) blitInPlace(sheet, it.raster, r.x, r.y); });
  return { sheet, rects };
}
