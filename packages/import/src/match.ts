import { srgbToOklab } from '@pixel-forge/core';
import type { RgbaImage } from './types.js';

const opaque = (i: RgbaImage, x: number, y: number) => x >= 0 && y >= 0 && x < i.w && y < i.h && (i.rgba[(y * i.w + x) * 4 + 3] ?? 0) >= 128;

/** 발 위치: 가장 아래 불투명 줄의 x 가운데, 그 y */
function feet(i: RgbaImage): [number, number] {
  let y1 = -1;
  for (let y = 0; y < i.h; y++) for (let x = 0; x < i.w; x++) if (opaque(i, x, y)) y1 = y;
  let x0 = -1, x1 = -1;
  for (let x = 0; x < i.w; x++) if (opaque(i, x, y1)) { if (x0 < 0) x0 = x; x1 = x; }
  return [(x0 + x1) / 2, y1];
}

/**
 * 재현성(사용자 결정 P8fix 1): 발 기준 정렬(±1px 반올림 여유) 후 실루엣 IoU + 겹친 불투명 픽셀 평균 OKLab ΔE.
 * 픽셀 일치는 폭 반올림 1px 차이로 의미가 없어 쓰지 않는다.
 */
export function silhouetteMatch(a: RgbaImage, b: RgbaImage): { iou: number; deltaE: number; offset: [number, number] } {
  const fa = feet(a), fb = feet(b);
  const bx = Math.round(fa[0] - fb[0]), by = fa[1] - fb[1];
  let iou = -1, offset: [number, number] = [0, 0];
  for (let dy = by - 1; dy <= by + 1; dy++) for (let dx = bx - 1; dx <= bx + 1; dx++) {
    let inter = 0, uni = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const p = opaque(a, x, y), q = opaque(b, x - dx, y - dy);
      if (p || q) uni++;
      if (p && q) inter++;
    }
    const v = uni ? inter / uni : 0;
    if (v > iou) { iou = v; offset = [dx, dy]; }
  }
  return { iou, deltaE: meanDeltaE(a, b, offset), offset };
}

/** 겹친 불투명 픽셀 평균 OKLab ΔE — 색 변환은 고유 색마다 한 번(픽셀마다 객체를 만들지 않게) */
function meanDeltaE(a: RgbaImage, b: RgbaImage, [dx, dy]: readonly [number, number]): number {
  const cache = new Map<number, Float64Array>();
  const lab = (img: RgbaImage, k: number): Float64Array => {
    const rgb = ((img.rgba[k] ?? 0) << 16) | ((img.rgba[k + 1] ?? 0) << 8) | (img.rgba[k + 2] ?? 0);
    let v = cache.get(rgb);
    if (!v) { const o = srgbToOklab(rgb >> 16, (rgb >> 8) & 255, rgb & 255); v = Float64Array.of(o.L, o.a, o.b); cache.set(rgb, v); }
    return v;
  };
  let n = 0, de = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (!opaque(a, x, y) || !opaque(b, x - dx, y - dy)) continue;
    const p = lab(a, (y * a.w + x) * 4), q = lab(b, ((y - dy) * b.w + x - dx) * 4);
    de += Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0), (p[2] ?? 0) - (q[2] ?? 0));
    n++;
  }
  return n ? de / n : 0;
}
