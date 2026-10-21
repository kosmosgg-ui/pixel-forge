import type { IndexedRaster, Ramp } from '@pixel-forge/core';
import type { FrameZone } from './frame-zone.js';

const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

/** rule: form.outline-thin — 두께 1px 이하 = 마스크에 꽉 찬 2×2 블록이 하나도 없는 파츠 */
export function isThinMask(mask: Uint8Array, w: number, h: number): boolean {
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
    const k = y * w + x;
    if (mask[k] && mask[k + 1] && mask[k + w] && mask[k + w + 1]) return false;
  }
  return true;
}

/**
 * rule: form.outline-thin — 얇은 파츠(1px 획)는 바깥 외곽선 대신 획 자체를 재질 외곽선 톤으로 칠한다.
 * 파츠마다 가장 밝게 비치는 픽셀 1개만 램프 최상단(칼날 하이라이트)으로 남긴다.
 */
export function thinStrokesInPlace(r: IndexedRaster, z: FrameZone, rampsById: readonly Ramp[], thin: ReadonlySet<number>, protect: Uint8Array): void {
  const best = new Map<number, number>();
  for (let k = 0; k < z.part.length; k++) {
    const p = z.part[k] ?? 0;
    if (!thin.has(p)) continue;
    const ramp = rampsById[(z.material[k] ?? 0) - 1];
    if (!ramp) continue;
    r.px[k] = ramp.outline;
    protect[k] = 1;
    const cur = best.get(p);
    if (cur === undefined || (z.lit[k] ?? 0) > (z.lit[cur] ?? 0)) best.set(p, k);
  }
  for (const k of best.values()) {
    const ramp = rampsById[(z.material[k] ?? 0) - 1];
    const top = ramp?.indices[ramp.indices.length - 1];
    if (top !== undefined) r.px[k] = top;
  }
}

/**
 * 내부선: 다른 파츠가 앞에서 겹치는 경계에서 뒤 파츠 쪽 1px를 그 재질 램프 0단계로.
 * 앞 파츠가 얇은 획이면 내부선을 긋지 않는다(획 양옆에 평행선이 생기지 않게, form.outline-thin).
 * 바꾼 위치는 protect에 1로 표시한다.
 */
export function innerLinesInPlace(r: IndexedRaster, z: FrameZone, rampsById: readonly Ramp[], protect: Uint8Array, thin: ReadonlySet<number> = new Set()): void {
  const hits: number[] = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const k = y * z.w + x;
    if (!z.material[k] || thin.has(z.part[k] ?? 0)) continue;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy, j = Y * z.w + X;
      if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || !z.material[j] || thin.has(z.part[j] ?? 0)) continue;
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
export function outerOutlineInPlace(
  r: IndexedRaster, z: FrameZone, rampsById: readonly Ramp[], o: OuterOutlineOptions, protect: Uint8Array, thin: ReadonlySet<number> = new Set(),
): void {
  if (o.mode === 'none') return;
  const writes: [number, number][] = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const k = y * z.w + x;
    if (z.material[k]) continue;
    let best = -1;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy, j = Y * z.w + X;
      // 얇은 획은 바깥 외곽선을 받지 않는다 (rule: form.outline-thin)
      if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || !z.material[j] || thin.has(z.part[j] ?? 0)) continue;
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
