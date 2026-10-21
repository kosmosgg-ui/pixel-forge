import { rotCS, type IndexedRaster, type Ramp } from '@pixel-forge/core';
import type { BoneWorld } from '@pixel-forge/rig';
import type { Rig, Spec } from '@pixel-forge/spec';
import type { FrameZone } from './frame-zone.js';

export interface EyeResult {
  /** 눈 픽셀 위치(캔버스 인덱스) */
  pixels: number[];
  colorIndex: number;
}

/**
 * rule: form.face — 눈은 모든 파츠를 그린 뒤 맨 위에 찍고 protect로 정리 단계에서 지켜진다.
 * 위치: spec.eyes.bone 중간점 + pos(화면 축). rig.eyes.count = 2면 먼 쪽 눈(1px)을 화면 앞쪽으로 spacing만큼 띄워 찍되,
 * 그 앞쪽 farEyeGap 픽셀까지 같은 뼈 파츠가 덮여 있게(머리 외곽선에 붙지 않게) 필요하면 안쪽으로 당긴다.
 */
export function drawEyesInPlace(
  r: IndexedRaster, z: FrameZone, spec: Spec, rig: Rig, bones: Readonly<Record<string, BoneWorld>>,
  rampsByName: Readonly<Record<string, Ramp>>, origin: readonly [number, number], farEyeGap: number, protect: Uint8Array,
): EyeResult | null {
  const eyes = spec.eyes;
  const b = eyes ? bones[eyes.bone] : undefined;
  if (!eyes || !b) return null;
  const [mat = '', step = '0'] = eyes.color.split(':');
  const colorIndex = rampsByName[mat]?.indices[Number(step)];
  if (colorIndex === undefined) return null;
  const [c, s] = rotCS(b.angle);
  const x = Math.round(b.x + (b.length / 2) * c) + eyes.pos[0] + origin[0];
  const y = Math.round(b.y + (b.length / 2) * s) + eyes.pos[1] + origin[1];
  const onBone = new Set(spec.parts.flatMap((p, i) => (p.bone === eyes.bone ? [i + 1] : [])));
  const covered = (X: number, Y: number) => X >= 0 && Y >= 0 && X < z.w && Y < z.h && onBone.has(z.part[Y * z.w + X] ?? 0);
  const pixels: number[] = [];
  const put = (X: number, Y: number) => {
    if (X < 0 || Y < 0 || X >= r.w || Y >= r.h) return;
    const k = Y * r.w + X;
    r.px[k] = colorIndex;
    protect[k] = 1;
    pixels.push(k);
  };
  for (let dy = 0; dy < eyes.size; dy++) put(x, y + dy);
  if (rig.eyes.count === 2) {
    for (let fx = x + rig.eyes.spacing; fx > x + 1; fx--) {
      let ok = covered(fx, y);
      for (let g = 1; g <= farEyeGap && ok; g++) ok = covered(fx + g, y);
      if (ok) { put(fx, y); break; }
    }
  }
  return { pixels, colorIndex };
}
