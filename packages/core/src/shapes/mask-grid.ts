import { ForgeError } from '../errors.js';
import type { ShapeMask } from './types.js';

export interface MaskLegendEntry {
  material: string;
  /** 생략하면 자동 셰이딩 */
  shade?: number;
  /** 그리드 특수 칸: eye = 검은 눈(외곽선색, 정리 보호), eye-color = 범례 색 눈(정리 보호), outline = 외곽선색 강제 */
  special?: 'eye' | 'eye-color' | 'outline';
}

/** special 버퍼 값 */
export const SPECIAL_EYE = 1;
export const SPECIAL_OUTLINE = 2;
export const SPECIAL_EYE_COLOR = 3;

export interface MaskGridParams {
  /** 앵커에 놓일 칸 [열, 행] */
  origin: readonly [number, number];
  rows: readonly string[];
  legend: Readonly<Record<string, MaskLegendEntry>>;
  /** 한 변 최대 칸 수(mask 16, 프레임 그리드는 캔버스 크기까지) */
  maxSize?: number;
}

export const AUTO_SHADE = 255;
const MAX_SIZE = 16;

export interface MaskGrid extends ShapeMask {
  /** material 버퍼 값 n은 materials[n-1]. 0 = 빈 칸 */
  materials: string[];
  material: Uint8Array;
  /** AUTO_SHADE = 자동 셰이딩, 빈 칸은 0 */
  shade: Uint8Array;
  /** 0 = 보통, SPECIAL_EYE, SPECIAL_OUTLINE */
  special: Uint8Array;
}

export function parseMaskGrid({ origin, rows, legend, maxSize = MAX_SIZE }: MaskGridParams): MaskGrid {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (w === 0 || h === 0 || w > maxSize || h > maxSize) {
    throw new ForgeError('shape.mask.size', `mask는 1×1 ~ ${maxSize}×${maxSize}이어야 합니다`, { w, h });
  }
  const materials = [...new Set(Object.values(legend).map((e) => e.material))].sort();
  const mask = new Uint8Array(w * h);
  const material = new Uint8Array(w * h);
  const shade = new Uint8Array(w * h);
  const special = new Uint8Array(w * h);
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
      special[k] = e.special === 'eye' ? SPECIAL_EYE : e.special === 'outline' ? SPECIAL_OUTLINE : e.special === 'eye-color' ? SPECIAL_EYE_COLOR : 0;
    }
  });
  return { w, h, ox: -origin[0], oy: -origin[1], mask, materials, material, shade, special };
}
