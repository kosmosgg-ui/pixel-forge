import { createIndexed, type IndexedRaster, type Ramp } from '@pixel-forge/core';
import type { FrameZone } from './frame-zone.js';

/** material + shade → 팔레트 인덱스. 재질 id n은 rampsById[n-1] */
export function resolveZone(z: FrameZone, rampsById: readonly Ramp[]): IndexedRaster {
  const out = createIndexed(z.w, z.h);
  for (let k = 0; k < z.material.length; k++) {
    const ramp = rampsById[(z.material[k] ?? 0) - 1];
    if (!ramp) continue;
    const idx = ramp.indices;
    out.px[k] = idx[Math.min(z.shade[k] ?? 0, idx.length - 1)] ?? 0;
  }
  return out;
}
