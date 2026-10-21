import { rotCS } from '@pixel-forge/core';
import type { BoneWorld } from '@pixel-forge/rig';
import type { DepthLayer, Part, Rig, Spec } from '@pixel-forge/spec';

const LAYER_RANK: Record<DepthLayer, number> = { back: 0, mid: 1, front: 2 };

export interface PlacedPart {
  /** spec.parts 안 위치 */
  index: number;
  part: Part;
  layer: DepthLayer;
  /** 파츠 원점(정수 픽셀) */
  x: number;
  y: number;
  /** 도형에 적용할 회전(도) */
  angle: number;
  /** 1부터, 클수록 앞 */
  depth: number;
}

/**
 * 렌더러는 뼈 이름을 해석하지 않는다: 순서는 (depthLayer, rig.drawOrder 위치, 파츠 z, 파츠 순번)으로만 정한다.
 */
export function placeParts(spec: Spec, rig: Rig, bones: Readonly<Record<string, BoneWorld>>): PlacedPart[] {
  const placed = spec.parts.map((part, index) => {
    const b = bones[part.bone];
    const bone = rig.bones[part.bone];
    if (!b || !bone) throw new RangeError(`리그에 없는 뼈: ${part.bone}`);
    const off = part.anchor === 'joint' ? 0 : part.anchor === 'mid' ? b.length / 2 : b.length;
    const [c, s] = rotCS(b.angle);
    const lx = off + part.at[0], ly = part.at[1];
    return {
      index, part, layer: bone.depthLayer,
      x: Math.round(b.x + lx * c - ly * s),
      y: Math.round(b.y + lx * s + ly * c),
      angle: part.orient === 'bone' ? b.angle : 0,
      order: rig.drawOrder.indexOf(part.bone),
      depth: 0,
    };
  });
  placed.sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer] || a.order - b.order || a.part.z - b.part.z || a.index - b.index);
  return placed.map(({ order: _order, ...p }, i) => ({ ...p, depth: i + 1 }));
}
