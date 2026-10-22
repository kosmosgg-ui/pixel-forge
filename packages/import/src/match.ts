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
  let best = { iou: -1, deltaE: 0, offset: [0, 0] as [number, number] };
  for (let dy = by - 1; dy <= by + 1; dy++) for (let dx = bx - 1; dx <= bx + 1; dx++) {
    let inter = 0, uni = 0, de = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const p = opaque(a, x, y), q = opaque(b, x - dx, y - dy);
      if (p || q) uni++;
      if (!p || !q) continue;
      inter++;
      const k = (y * a.w + x) * 4, j = ((y - dy) * b.w + x - dx) * 4;
      const l1 = srgbToOklab(a.rgba[k] ?? 0, a.rgba[k + 1] ?? 0, a.rgba[k + 2] ?? 0), l2 = srgbToOklab(b.rgba[j] ?? 0, b.rgba[j + 1] ?? 0, b.rgba[j + 2] ?? 0);
      de += Math.hypot(l1.L - l2.L, l1.a - l2.a, l1.b - l2.b);
    }
    const iou = uni ? inter / uni : 0;
    if (iou > best.iou) best = { iou, deltaE: inter ? de / inter : 0, offset: [dx, dy] };
  }
  return best;
}
