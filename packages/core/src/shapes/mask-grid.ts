import { ForgeError } from '../errors.js';
import type { ShapeMask } from './types.js';

export interface MaskLegendEntry {
  material: string;
  /** 생략하면 자동 셰이딩 */
  shade?: number;
}

export interface MaskGridParams {
  /** 앵커에 놓일 칸 [열, 행] */
  origin: readonly [number, number];
  rows: readonly string[];
  legend: Readonly<Record<string, MaskLegendEntry>>;
}

export const AUTO_SHADE = 255;
const MAX_SIZE = 16;

export interface MaskGrid extends ShapeMask {
  /** material 버퍼 값 n은 materials[n-1]. 0 = 빈 칸 */
  materials: string[];
  material: Uint8Array;
  /** AUTO_SHADE = 자동 셰이딩, 빈 칸은 0 */
  shade: Uint8Array;
}

export function parseMaskGrid({ origin, rows, legend }: MaskGridParams): MaskGrid {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (w === 0 || h === 0 || w > MAX_SIZE || h > MAX_SIZE) {
    throw new ForgeError('shape.mask.size', `mask는 1×1 ~ ${MAX_SIZE}×${MAX_SIZE}이어야 합니다`, { w, h });
  }
  const materials = [...new Set(Object.values(legend).map((e) => e.material))].sort();
  const mask = new Uint8Array(w * h);
  const material = new Uint8Array(w * h);
  const shade = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new ForgeError('shape.mask.ragged', '모든 행의 길이가 같아야 합니다', { row: y });
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      const e = legend[ch];
      if (!e) throw new ForgeError('shape.mask.legend', `legend에 없는 문자: ${ch}`, { x, y });
      const k = y * w + x;
      mask[k] = 1;
      material[k] = materials.indexOf(e.material) + 1;
      shade[k] = e.shade ?? AUTO_SHADE;
    }
  });
  return { w, h, ox: -origin[0], oy: -origin[1], mask, materials, material, shade };
}
