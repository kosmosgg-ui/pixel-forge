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

export interface FaceStats {
  /** 머리 뼈 파츠가 가려지기 전 차지하는 면적 */
  area: number;
  /** 그중 최종적으로 다른 뼈 파츠가 덮은 픽셀 수 */
  covered: number;
  /** 머리 면적 위에 손에 든 파츠(held)가 그려진 픽셀 수 */
  heldOver: number;
  /** 눈 둘레 창(눈 픽셀 박스, 최소 3×2) 크기와 그중 얼굴 재질이 아닌 픽셀 수 */
  eyeWindow: number;
  eyeWindowBad: number;
}

/**
 * form.face-clear 재료. 머리 뼈는 spec.eyes.bone으로만 안다(뼈 이름 미참조).
 * 얼굴 재질 = 머리 뼈 첫 파츠의 재질. 눈 둘레 창은 투구·두건 같은 같은 뼈의 다른 재질이 덮어도 실패로 친다
 * (눈만 금속 위에 찍히면 얼굴로 읽히지 않는다).
 */
export function faceStats(
  z: FrameZone, spec: Spec, rasters: readonly { x0: number; y0: number; w: number; h: number; mask: Uint8Array }[],
  partIndexOf: readonly number[], origin: readonly [number, number], eyePixels: readonly number[], materialId: (m: string) => number,
): FaceStats | null {
  const bone = spec.eyes?.bone;
  if (bone === undefined) return null;
  const head = new Set(spec.parts.flatMap((p, i) => (p.bone === bone ? [i + 1] : [])));
  const held = new Set(spec.parts.flatMap((p, i) => (p.held ? [i + 1] : [])));
  const area = new Uint8Array(z.w * z.h);
  rasters.forEach((r, i) => {
    if (!head.has((partIndexOf[i] ?? -1) + 1)) return;
    for (let j = 0; j < r.h; j++) for (let k = 0; k < r.w; k++) {
      const X = r.x0 + k + origin[0], Y = r.y0 + j + origin[1];
      if (r.mask[j * r.w + k] && X >= 0 && Y >= 0 && X < z.w && Y < z.h) area[Y * z.w + X] = 1;
    }
  });
  let n = 0, covered = 0, heldOver = 0;
  for (let k = 0; k < area.length; k++) {
    if (!area[k]) continue;
    n++;
    if (!head.has(z.part[k] ?? 0)) covered++;
    if (held.has(z.part[k] ?? 0)) heldOver++;
  }
  const faceMat = materialId(spec.parts.find((p) => p.bone === bone)?.material ?? '');
  const win = eyeWindow(eyePixels, z.w);
  let eyeWindowBad = 0;
  for (const k of win) if (z.material[k] !== faceMat || !head.has(z.part[k] ?? 0)) eyeWindowBad++;
  return { area: n, covered, heldOver, eyeWindow: win.length, eyeWindowBad };
}

/** 눈 픽셀 박스를 가로 3·세로 2 이상으로 넓힌 창(가로는 양옆, 세로는 아래로 — 눈 아래 볼이 얼굴로 읽히게) */
function eyeWindow(eyes: readonly number[], w: number): number[] {
  if (!eyes.length) return [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of eyes) { const x = k % w, y = (k - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 - x0 < 2) { x0 = Math.min(x0, x1 - 1); x1 = x0 + 2; }
  if (y1 - y0 < 1) y1 = y0 + 1;
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < w && y >= 0) out.push(y * w + x);
  return out;
}
