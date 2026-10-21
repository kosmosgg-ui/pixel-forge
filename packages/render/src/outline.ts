import type { IndexedRaster, Ramp } from '@pixel-forge/core';
import type { FrameZone } from './frame-zone.js';

const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

/**
 * 내부선: 다른 파츠가 앞에서 겹치는 경계에서 뒤 파츠 쪽 1px를 그 재질 램프 0단계로.
 * 바꾼 위치는 protect에 1로 표시한다.
 */
export function innerLinesInPlace(r: IndexedRaster, z: FrameZone, rampsById: readonly Ramp[], protect: Uint8Array): void {
  const hits: number[] = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const k = y * z.w + x;
    if (!z.material[k]) continue;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy, j = Y * z.w + X;
      if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || !z.material[j]) continue;
      if (z.part[j] !== z.part[k] && (z.depth[j] ?? 0) > (z.depth[k] ?? 0)) { hits.push(k); break; }
    }
  }
  for (const k of hits) {
    const ramp = rampsById[(z.material[k] ?? 0) - 1];
    if (ramp?.indices[0] === undefined) continue;
    r.px[k] = ramp.indices[0];
    protect[k] = 1;
  }
}

export interface OuterOutlineOptions {
  mode: 'selout' | 'dark' | 'none';
  globalIndex: number;
  litThreshold: number;
}

/**
 * 실루엣 바깥 1px(4-이웃). 인접 픽셀 중 가장 앞(depth 큰) 파츠 기준.
 * selout: 광원 쪽 면(n·L > litThreshold)은 ramp[0], 어두운 면은 재질 외곽선 톤 — 그림자 색과 외곽선이 겹치지 않게.
 * dark: 전역 외곽선색. 판정은 외곽선 그리기 전 상태 기준.
 */
export function outerOutlineInPlace(r: IndexedRaster, z: FrameZone, rampsById: readonly Ramp[], o: OuterOutlineOptions, protect: Uint8Array): void {
  if (o.mode === 'none') return;
  const writes: [number, number][] = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const k = y * z.w + x;
    if (z.material[k]) continue;
    let best = -1;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy, j = Y * z.w + X;
      if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || !z.material[j]) continue;
      if (best < 0 || (z.depth[j] ?? 0) > (z.depth[best] ?? 0)) best = j;
    }
    if (best < 0) continue;
    const ramp = rampsById[(z.material[best] ?? 0) - 1];
    if (!ramp) continue;
    const lit = (z.lit[best] ?? 0) > o.litThreshold;
    writes.push([k, o.mode === 'dark' ? o.globalIndex : lit ? ramp.indices[0] ?? ramp.outline : ramp.outline]);
  }
  for (const [k, v] of writes) { r.px[k] = v; protect[k] = 1; }
}
