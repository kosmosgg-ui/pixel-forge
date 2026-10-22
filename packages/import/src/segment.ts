import type { RgbaImage, Sprite } from './types.js';

interface Comp { labels: number[]; x0: number; y0: number; x1: number; y1: number }

/** 불투명 마스크를 r칸(체비셰프) 팽창 — 가로·세로 두 번 나눠 O(n·r) */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let d = Math.max(0, x - r); d <= Math.min(w - 1, x + r); d++) a[y * w + d] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!a[y * w + x]) continue;
    for (let d = Math.max(0, y - r); d <= Math.min(h - 1, y + r); d++) b[d * w + x] = 1;
  }
  return b;
}

/** 8-연결 성분 번호(1부터). 0 = 빈칸 */
function label8(m: Uint8Array, w: number, h: number): { label: Int32Array; count: number } {
  const label = new Int32Array(w * h);
  let count = 0;
  const stack: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue;
    label[s] = ++count;
    stack.push(s);
    while (stack.length) {
      const k = stack.pop() ?? 0, x = k % w, y = (k - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && m[j] && !label[j]) { label[j] = count; stack.push(j); }
      }
    }
  }
  return { label, count };
}

const gap = (a: Comp, b: Comp) => Math.max(0, a.x0 - b.x1, b.x0 - a.x1) + Math.max(0, a.y0 - b.y1, b.y0 - a.y1);

/** 작은 조각(키 < 기준의 ratio배)을 가장 가까운 큰 성분에 합친다 — 검 끝·머리카락 끝이 떨어진 경우 */
function mergeSmall(comps: Comp[], refH: number, ratio: number): Comp[] {
  const big = comps.filter((c) => c.y1 - c.y0 + 1 >= refH * ratio);
  if (!big.length) return comps;
  for (const c of comps) {
    if (big.includes(c)) continue;
    let best = big[0] as Comp, bestD = Infinity;
    for (const b of big) { const d = gap(c, b); if (d < bestD) { bestD = d; best = b; } }
    best.labels.push(...c.labels);
    best.x0 = Math.min(best.x0, c.x0); best.y0 = Math.min(best.y0, c.y0); best.x1 = Math.max(best.x1, c.x1); best.y1 = Math.max(best.y1, c.y1);
  }
  return big;
}

export interface SegmentOptions {
  /** 팽창 칸 수(2px — 가는 선으로 이어진 부분을 한 성분으로) */
  dilate?: number;
  /** 작은 조각 기준 키(px, 원본 좌표). 없으면 성분 키의 중앙값 */
  refHeight?: number;
  /** 기준 키 대비 이 비율 미만이면 조각(0.4) */
  smallRatio?: number;
}

/**
 * 격자를 믿지 않는 스프라이트 분리(사용자 승인 P8): 불투명 마스크 팽창 → 8-연결 성분 → 작은 조각 병합.
 * bbox가 겹쳐도(GPT가 칸을 넘음) 성분 번호로 잘라 이웃 스프라이트 픽셀이 섞이지 않는다.
 */
export function segmentSprites(img: RgbaImage, o: SegmentOptions = {}): Sprite[] {
  const { w, h, rgba } = img;
  const mask = new Uint8Array(w * h);
  for (let k = 0; k < mask.length; k++) mask[k] = (rgba[k * 4 + 3] ?? 0) > 0 ? 1 : 0;
  const { label, count } = label8(dilate(mask, w, h, o.dilate ?? 2), w, h);
  const byLabel: (Comp | undefined)[] = [];
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k]) continue;
    const l = label[k] ?? 0, x = k % w, y = (k - x) / w;
    const c = byLabel[l] ?? (byLabel[l] = { labels: [l], x0: x, y0: y, x1: x, y1: y });
    c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y); c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
  }
  const comps = byLabel.filter((c): c is Comp => c !== undefined && count > 0);
  const heights = comps.map((c) => c.y1 - c.y0 + 1).sort((a, b) => a - b);
  const ref = o.refHeight ?? heights[Math.floor(heights.length / 2)] ?? 0;
  return mergeSmall(comps, ref, o.smallRatio ?? 0.4).map((c) => ({ ...cropComp(img, label, c), clipped: edgesTouched(img, c).length > 0, edges: edgesTouched(img, c) }));
}

function cropComp(img: RgbaImage, label: Int32Array, c: Comp): Sprite {
  const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1, set = new Set(c.labels), out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const k = (c.y0 + y) * img.w + c.x0 + x;
    if (!set.has(label[k] ?? 0) || !(img.rgba[k * 4 + 3] ?? 0)) continue;
    out.set(img.rgba.subarray(k * 4, k * 4 + 4), (y * cw + x) * 4);
  }
  return { x: c.x0, y: c.y0, w: cw, h: ch, img: { w: cw, h: ch, rgba: out }, clipped: false };
}

/**
 * rule: import.clipped — 잘림 = 알파 ≥ 기준(이진화 후 불투명) 픽셀이 이미지 바깥 1px 행·열에 닿은 스프라이트(사용자 결정 P8fix 2).
 * 팽창 마스크나 옅은 원본 알파로 재지 않는다(기획 측정 3은 팽창 마스크 값이었다). 닿은 변을 돌려준다.
 */
export function edgesTouched(img: RgbaImage, c: { x0: number; y0: number; x1: number; y1: number }): string[] {
  return [c.y0 === 0 ? 'top' : '', c.y1 === img.h - 1 ? 'bottom' : '', c.x0 === 0 ? 'left' : '', c.x1 === img.w - 1 ? 'right' : ''].filter(Boolean);
}
