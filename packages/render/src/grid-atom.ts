import { parseMaskGrid, rotateMaskGrid, type MaskGrid, type MaskLegendEntry } from '@pixel-forge/core';
import type { GridShape, Part } from '@pixel-forge/spec';

/** 그리드 한 변 최대 칸 수(가장 큰 캔버스 기준) */
export const GRID_MAX = 96;
/** 머리 아톰(upright)은 이 각도 이내면 회전 대신 1px 이동 */
export const UPRIGHT_TILT = 15;

/**
 * 그리드 범례 "<재질>:<단계>" | "@eye" | "@eye:<재질>:<단계>" | "@outline" → mask 범례.
 * "@eye"·"@outline" 칸은 그리드의 첫 재질로 실루엣을 채우고(외곽선이 안으로 파고들지 않게) 색은 렌더가 외곽선색으로 덮는다.
 */
export function gridToMask(g: Pick<GridShape, 'rows' | 'legend' | 'origin'>): MaskGrid {
  const real = Object.values(g.legend).flatMap((v) => (v.startsWith('@outline') || v === '@eye' ? [] : [v.replace(/^@eye:/, '').split(':')[0] ?? '']));
  const filler = [...real].sort()[0] ?? 'none';
  const legend: Record<string, MaskLegendEntry> = {};
  for (const [ch, v] of Object.entries(g.legend)) {
    if (v === '@outline') legend[ch] = { material: filler, shade: 0, special: 'outline' };
    else if (v === '@eye') legend[ch] = { material: filler, shade: 0, special: 'eye' };
    else {
      const [mat = '', step = '0'] = v.replace(/^@eye:/, '').split(':');
      legend[ch] = { material: mat, shade: Number(step), ...(v.startsWith('@eye:') ? { special: 'eye-color' as const } : {}) };
    }
  }
  const w = g.rows[0]?.length ?? 0, h = g.rows.length;
  const origin = g.origin ?? [Math.floor(w / 2), Math.floor(h / 2)];
  return parseMaskGrid({ origin, rows: g.rows, legend, maxSize: GRID_MAX });
}

const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

export interface AtomPick {
  grid: MaskGrid;
  /** 1px 이동(upright 기울기) */
  dx: number;
  /** 회전을 RotSprite로 처리했지만 각도 변형이 없어 전체를 돌린 경우 */
  warning?: string;
}

/**
 * 아톰 회전 품질 보호: 그린 각도 변형(variants) 중 파츠 각도에 가장 가까운 것을 고르고 남은 각도만 RotSprite.
 * 변형이 없으면 기본 그리드 전체를 RotSprite로 돌리고 경고. upright(머리)는 ±15° 이내면 돌리지 않고 1px 이동.
 */
export function pickAtom(part: Part, shape: GridShape, angle: number): AtomPick {
  const a = norm(angle);
  if (part.upright && Math.abs(a) <= UPRIGHT_TILT) return { grid: gridToMask(shape), dx: a > 5 ? 1 : a < -5 ? -1 : 0 };
  const variants: [number, GridShape][] = [[0, shape], ...Object.entries(part.variants ?? {}).map(([k, g]) => [Number(k), g] as [number, GridShape])];
  let best = variants[0] ?? [0, shape];
  for (const v of variants) if (Math.abs(norm(a - v[0])) < Math.abs(norm(a - best[0]))) best = v;
  const rest = norm(a - best[0]);
  const base = gridToMask(best[1]);
  if (Math.abs(rest) < 0.5) return { grid: base, dx: 0 };
  const grid = rotateMaskGrid(base, rest);
  const big = Math.abs(rest) > 22.5 && !part.variants;
  return { grid, dx: 0, ...(big ? { warning: `${part.name ?? part.bone}: 각도 변형 없이 ${Math.round(rest)}° RotSprite` } : {}) };
}
