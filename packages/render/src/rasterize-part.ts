import {
  parseMaskGrid, rasterCapsule, rasterEllipse, rasterLine, rasterPoly, rasterRect, rotateMaskGrid, type ShapeMask,
} from '@pixel-forge/core';
import type { PartShape } from '@pixel-forge/spec';
import { AUTO } from './frame-zone.js';
import { pickAtom } from './grid-atom.js';
import type { PlacedPart } from './place.js';

/** 월드 좌표에 놓인 파츠 래스터 */
export interface PartRaster {
  x0: number;
  y0: number;
  w: number;
  h: number;
  mask: Uint8Array;
  normals?: Int8Array;
  /** 픽셀별 재질 id (zone 기준, 1부터) */
  material: Uint8Array;
  /** 픽셀별 고정 shade, AUTO = 자동 */
  fixed: Uint8Array;
  /** 그리드 특수 칸(SPECIAL_EYE·SPECIAL_OUTLINE) */
  special?: Uint8Array;
  /** 픽셀을 직접 설계한 파츠(그리드) — 자동 셰이딩·정리·얇은 획 규칙을 건너뛴다 */
  authored?: boolean;
  warning?: string;
}

function fillShape(shape: Exclude<PartShape, { type: 'mask' } | { type: 'grid' }>, angle: number): ShapeMask {
  const a = angle + ('angleDeg' in shape ? shape.angleDeg ?? 0 : 0);
  switch (shape.type) {
    case 'line': return rasterLine({ to: shape.to, ...(shape.from ? { from: shape.from } : {}), angleDeg: angle });
    case 'rect': return rasterRect({ w: shape.w, h: shape.h, ...(shape.chamfer !== undefined ? { chamfer: shape.chamfer } : {}), angleDeg: a });
    case 'ellipse': return rasterEllipse({ w: shape.w, h: shape.h, angleDeg: a });
    case 'capsule': return rasterCapsule({ len: shape.len, w: shape.w, angleDeg: a });
    case 'poly': return rasterPoly({ pts: shape.pts, ...(shape.normalHint ? { normalHint: shape.normalHint } : {}), angleDeg: a });
  }
}

/** 재질 이름 → zone 재질 id (바이블 재질 키 정렬 순서, 1부터) */
export function rasterizePart(p: PlacedPart, materialId: (name: string) => number): PartRaster {
  const shape = p.part.shape;
  if (shape.type === 'grid') {
    const { grid: g, dx, warning } = pickAtom(p.part, shape, p.angle);
    const ids = g.materials.map(materialId);
    const material = g.material.map((m) => (m ? ids[m - 1] ?? 0 : 0));
    return {
      x0: p.x + g.ox + dx, y0: p.y + g.oy, w: g.w, h: g.h, mask: g.mask, material,
      fixed: g.shade.map((sh, i) => (g.mask[i] ? sh : AUTO)), special: g.special, authored: true, ...(warning ? { warning } : {}),
    };
  }
  if (shape.type === 'mask') {
    const g0 = parseMaskGrid(shape);
    const g = p.angle % 360 === 0 ? g0 : rotateMaskGrid(g0, p.angle);
    const ids = g.materials.map(materialId);
    const material = g.material.map((m) => (m ? ids[m - 1] ?? 0 : 0));
    return { x0: p.x + g.ox, y0: p.y + g.oy, w: g.w, h: g.h, mask: g.mask, material, fixed: g.shade.map((s, i) => (g.mask[i] ? s : AUTO)) };
  }
  const m = fillShape(shape, p.angle);
  const id = materialId(p.part.material ?? '');
  return {
    x0: p.x + m.ox, y0: p.y + m.oy, w: m.w, h: m.h, mask: m.mask,
    ...(m.normals ? { normals: m.normals } : {}),
    material: m.mask.map((v) => (v ? id : 0)),
    fixed: new Uint8Array(m.w * m.h).fill(AUTO),
  };
}
