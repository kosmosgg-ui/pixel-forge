import type { RgbaImage } from './types.js';

/** 출력 칸마다 걸치는 원본 칸과 겹친 길이(면적 가중) — 비정수 배율의 BOX 필터 */
function weights(src: number, dst: number): { start: Int32Array; count: Int32Array; idx: Int32Array; w: Float64Array } {
  const scale = src / dst;
  const start = new Int32Array(dst), count = new Int32Array(dst), idx: number[] = [], ws: number[] = [];
  for (let o = 0; o < dst; o++) {
    const a = o * scale, b = (o + 1) * scale;
    start[o] = idx.length;
    for (let s = Math.floor(a); s < Math.min(src, Math.ceil(b)); s++) {
      const wt = Math.min(b, s + 1) - Math.max(a, s);
      if (wt > 1e-9) { idx.push(s); ws.push(wt); }
    }
    count[o] = idx.length - (start[o] ?? 0);
  }
  return { start, count, idx: Int32Array.from(idx), w: Float64Array.from(ws) };
}

/**
 * 알파 사전곱 BOX 축소(사용자 승인 P8): 색 × 알파를 면적 가중 평균 → 알파로 나눠 되돌린 뒤 알파 이진화.
 * 최근접 축소는 가는 선(외곽선·머리카락)을 끊기 때문에 쓰지 않는다. 결과 알파는 0 또는 255.
 */
export function boxDownscale(img: RgbaImage, factor: number, alphaThreshold = 128): RgbaImage {
  const ow = Math.max(1, Math.round(img.w * factor)), oh = Math.max(1, Math.round(img.h * factor));
  const wx = weights(img.w, ow), wy = weights(img.h, oh);
  const out = new Uint8Array(ow * oh * 4);
  for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let j = 0; j < (wy.count[oy] ?? 0); j++) {
      const sy = wy.idx[(wy.start[oy] ?? 0) + j] ?? 0, wyv = wy.w[(wy.start[oy] ?? 0) + j] ?? 0;
      for (let i = 0; i < (wx.count[ox] ?? 0); i++) {
        const sx = wx.idx[(wx.start[ox] ?? 0) + i] ?? 0, wt = wyv * (wx.w[(wx.start[ox] ?? 0) + i] ?? 0);
        const k = (sy * img.w + sx) * 4, al = (img.rgba[k + 3] ?? 0) / 255;
        r += (img.rgba[k] ?? 0) * al * wt; g += (img.rgba[k + 1] ?? 0) * al * wt; b += (img.rgba[k + 2] ?? 0) * al * wt;
        a += al * wt; area += wt;
      }
    }
    const alpha = area ? a / area : 0;
    if (alpha * 255 < alphaThreshold || a <= 0) continue;
    const q = (oy * ow + ox) * 4;
    out[q] = Math.round(r / a); out[q + 1] = Math.round(g / a); out[q + 2] = Math.round(b / a); out[q + 3] = 255;
  }
  return { w: ow, h: oh, rgba: out };
}
