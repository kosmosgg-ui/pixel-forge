import { oklabToSrgb, srgbToOklab, type Lab } from '@pixel-forge/core';
import type { RgbaImage } from './types.js';

interface Entry { rgb: number; lab: Lab; n: number }

/** 불투명 픽셀의 고유 색 히스토그램(색 → 개수), 색 번호 순서(결정론) */
function histogram(imgs: readonly RgbaImage[]): Entry[] {
  const m = new Map<number, number>();
  for (const img of imgs) for (let k = 0; k < img.rgba.length; k += 4) {
    if (!img.rgba[k + 3]) continue;
    const c = ((img.rgba[k] ?? 0) << 16) | ((img.rgba[k + 1] ?? 0) << 8) | (img.rgba[k + 2] ?? 0);
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([rgb, n]) => ({ rgb, n, lab: srgbToOklab(rgb >> 16, (rgb >> 8) & 255, rgb & 255) }));
}

const AXES = ['L', 'a', 'b'] as const;

/** 상자 안 가장 넓은 축과 그 폭 */
function widest(box: readonly Entry[]): { axis: (typeof AXES)[number]; range: number } {
  let best: { axis: (typeof AXES)[number]; range: number } = { axis: 'L', range: -1 };
  for (const axis of AXES) {
    let lo = Infinity, hi = -Infinity;
    for (const e of box) { lo = Math.min(lo, e.lab[axis]); hi = Math.max(hi, e.lab[axis]); }
    if (hi - lo > best.range) best = { axis, range: hi - lo };
  }
  return best;
}

/**
 * OKLab median-cut: 가장 넓은 상자를 가장 넓은 축의 개수 가중 중앙에서 자르기를 max개가 될 때까지.
 * 대표색 = 상자의 개수 가중 평균(OKLab) → sRGB. 결과는 명도(L) 오름차순 0xRRGGBB 목록.
 */
export function medianCut(imgs: readonly RgbaImage[], max: number): number[] {
  let boxes: Entry[][] = [histogram(imgs)].filter((b) => b.length);
  while (boxes.length < max) {
    const ranked = boxes.map((b, i) => ({ i, ...widest(b) })).filter((x) => (boxes[x.i]?.length ?? 0) > 1).sort((a, b) => b.range - a.range || a.i - b.i);
    const pick = ranked[0];
    if (!pick || pick.range <= 0) break;
    const box = [...(boxes[pick.i] ?? [])].sort((a, b) => a.lab[pick.axis] - b.lab[pick.axis] || a.rgb - b.rgb);
    const total = box.reduce((s, e) => s + e.n, 0);
    let acc = 0, cut = 1;
    for (let j = 0; j < box.length - 1; j++) { acc += box[j]?.n ?? 0; if (acc * 2 >= total) { cut = j + 1; break; } cut = j + 1; }
    boxes = [...boxes.slice(0, pick.i), box.slice(0, cut), box.slice(cut), ...boxes.slice(pick.i + 1)];
  }
  const cols = boxes.map((b) => {
    const n = b.reduce((s, e) => s + e.n, 0);
    const lab = { L: b.reduce((s, e) => s + e.lab.L * e.n, 0) / n, a: b.reduce((s, e) => s + e.lab.a * e.n, 0) / n, b: b.reduce((s, e) => s + e.lab.b * e.n, 0) / n };
    const [r, g, bl] = oklabToSrgb(lab).map((v) => Math.max(0, Math.min(255, Math.round(v))));
    return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (bl ?? 0);
  });
  return [...new Set(cols)].map((c) => ({ c, L: srgbToOklab(c >> 16, (c >> 8) & 255, c & 255).L })).sort((a, b) => a.L - b.L || a.c - b.c).map((x) => x.c);
}

export interface Quantized {
  /** 칸마다 팔레트 순번 + 1(0 = 투명) */
  px: Uint8Array;
  /** 양자화 전후 OKLab 거리 합·불투명 칸 수(import.palette-delta) */
  delta: number;
  count: number;
}

/** 팔레트에 최근접(OKLab) 매핑, 디더링 없음. 같은 색은 한 번만 계산 */
export function quantize(img: RgbaImage, palette: readonly number[]): Quantized {
  const labs = palette.map((c) => srgbToOklab(c >> 16, (c >> 8) & 255, c & 255));
  const memo = new Map<number, [number, number]>();
  const px = new Uint8Array(img.w * img.h);
  let delta = 0, count = 0;
  for (let k = 0; k < px.length; k++) {
    if (!img.rgba[k * 4 + 3]) continue;
    const c = ((img.rgba[k * 4] ?? 0) << 16) | ((img.rgba[k * 4 + 1] ?? 0) << 8) | (img.rgba[k * 4 + 2] ?? 0);
    let hit = memo.get(c);
    if (!hit) {
      const lab = srgbToOklab(c >> 16, (c >> 8) & 255, c & 255);
      let best = 0, bestD = Infinity;
      labs.forEach((l, i) => { const d = Math.hypot(l.L - lab.L, l.a - lab.a, l.b - lab.b); if (d < bestD) { bestD = d; best = i; } });
      hit = [best + 1, bestD];
      memo.set(c, hit);
    }
    px[k] = hit[0];
    delta += hit[1];
    count++;
  }
  return { px, delta, count };
}
