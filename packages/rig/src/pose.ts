import type { Pose as PoseDeltas } from '@pixel-forge/spec';

/** 뼈 단위로 덮어쓴다(같은 뼈면 over가 통째로 이긴다) */
export function mergePose(base: PoseDeltas, over: PoseDeltas = {}): PoseDeltas {
  return { ...base, ...over };
}

/** 각도·오프셋을 정수로 스냅 — 프레임마다 픽셀이 흔들리지 않게 (§8.2) */
export function snapPose(p: PoseDeltas): PoseDeltas {
  const out: PoseDeltas = {};
  for (const [bone, d] of Object.entries(p)) {
    const rot = Math.round(d.rot ?? 0), dx = Math.round(d.dx ?? 0), dy = Math.round(d.dy ?? 0);
    if (rot || dx || dy) out[bone] = { ...(rot ? { rot } : {}), ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) };
  }
  return out;
}

/** a → b를 t(0~1)만큼 선형 보간한 뒤 정수 스냅 */
export function lerpPose(a: PoseDeltas, b: PoseDeltas, t: number): PoseDeltas {
  const out: PoseDeltas = {};
  for (const bone of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[bone] ?? {}, y = b[bone] ?? {};
    const mix = (k: 'rot' | 'dx' | 'dy') => (x[k] ?? 0) + ((y[k] ?? 0) - (x[k] ?? 0)) * t;
    out[bone] = { rot: mix('rot'), dx: mix('dx'), dy: mix('dy') };
  }
  return snapPose(out);
}

/** root가 움직이지 않는 포즈(발밑 기준선 검사 대상) */
export function isRootFixed(p: PoseDeltas, root: string): boolean {
  const r = p[root];
  return !r || (!(r.rot ?? 0) && !(r.dx ?? 0) && !(r.dy ?? 0));
}
