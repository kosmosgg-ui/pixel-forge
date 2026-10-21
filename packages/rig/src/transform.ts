import { rotCS } from '@pixel-forge/core';
import type { Rig } from '@pixel-forge/spec';

/** 뼈 관절의 월드 위치(정수 스냅)와 각도(도) */
export interface BoneWorld {
  x: number;
  y: number;
  angle: number;
  /** 축척된 뼈 길이(px) */
  length: number;
}

/** 포즈 변화량. rig.restPose 위에 더해진다(P4 키 포즈) */
export interface BoneDelta {
  rot?: number;
  dx?: number;
  dy?: number;
}

export type Pose = Readonly<Record<string, BoneDelta>>;

/** 부모 → 자식 순서 (결정론: 같은 깊이는 이름순) */
export function boneOrder(rig: Rig): string[] {
  const names = Object.keys(rig.bones).sort();
  const depth = (n: string): number => {
    let d = 0;
    for (let p = rig.bones[n]?.parent; p; p = rig.bones[p]?.parent) d++;
    return d;
  };
  return names.sort((a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * 관절은 부모의 스냅된 위치 + 부모 각도로 돌린 pivot·축척을 반올림해 정수로 맞춘다.
 * 정수 위치를 사슬로 이어 가므로 같은 리그·포즈면 픽셀이 흔들리지 않는다.
 * 각 뼈 각도 = 차렷(restAngle) + rig.restPose(전투 대기) + pose.
 */
export function solveRig(rig: Rig, scale = 1, pose: Pose = {}): Record<string, BoneWorld> {
  const out: Record<string, BoneWorld> = {};
  for (const name of boneOrder(rig)) {
    const b = rig.bones[name];
    if (!b) continue;
    const r = rig.restPose[name] ?? {};
    const p = pose[name] ?? {};
    const d = { rot: (r.rot ?? 0) + (p.rot ?? 0), dx: (r.dx ?? 0) + (p.dx ?? 0), dy: (r.dy ?? 0) + (p.dy ?? 0) };
    const parent = b.parent === null ? undefined : out[b.parent];
    const pa = parent?.angle ?? 0;
    const [c, s] = rotCS(pa);
    const px = b.pivot[0] * scale, py = b.pivot[1] * scale;
    out[name] = {
      x: Math.round((parent?.x ?? 0) + px * c - py * s + d.dx),
      y: Math.round((parent?.y ?? 0) + px * s + py * c + d.dy),
      angle: pa + b.restAngle + d.rot,
      length: b.length * scale,
    };
  }
  return out;
}
