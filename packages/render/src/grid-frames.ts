import { ForgeError, flipX, type IndexedRaster } from '@pixel-forge/core';
import type { FrameGrid, GridPatch } from '@pixel-forge/spec';
import { assertFrame } from './assert.js';
import { fitBudgetInPlace } from './budget-fit.js';
import { createFrameZone, type FrameZone } from './frame-zone.js';
import { applyFxInPlace } from './fx.js';
import { gridToMask } from './grid-atom.js';
import { outerOutlineInPlace } from './outline.js';
import type { AnimFrame, AnimRender } from './render-anim.js';
import { applySpecialsInPlace, BOTTOM_GAP, flipLayer, noFit, outlineModeOf, rampsOf, type RenderContext, type RenderResult } from './render-frame.js';
import { resolveZone } from './resolve.js';

/** 프레임 모드 파츠 id: base 그리드 = 1, patch = 2 (anim.flicker는 patch 밖 = base 영역만 비교) */
const BASE = 1, PATCH = 2;

/** 발밑 칸: pivot 또는 불투명 칸의 아래 가운데 */
function pivotOf(g: FrameGrid): [number, number] {
  if (g.pivot) return g.pivot;
  let x0 = Infinity, x1 = -Infinity, y1 = -1;
  g.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }));
  return [Math.floor((x0 + x1) / 2), y1];
}

/** 그리드 칸을 zone에 기록(재질·고정 단계·특수 칸). patch의 "~"는 지운다 */
function writeGridInPlace(z: FrameZone, g: Pick<FrameGrid, 'rows' | 'legend'>, ox: number, oy: number, part: number, materialId: (m: string) => number): number {
  let clipped = 0;
  const erase = g.rows.map((r) => [...r].map((ch) => ch === '~'));
  const m = gridToMask({ rows: g.rows.map((r) => r.replace(/~/g, '.')), legend: g.legend, origin: [0, 0] });
  const ids = m.materials.map(materialId);
  for (let y = 0; y < g.rows.length; y++) for (let x = 0; x < (g.rows[0]?.length ?? 0); x++) {
    const X = ox + x, Y = oy + y;
    const inside = X >= 0 && Y >= 0 && X < z.w && Y < z.h;
    const i = y * m.w + x, k = Y * z.w + X;
    if (erase[y]?.[x]) { if (inside) { z.material[k] = 0; z.part[k] = 0; z.special[k] = 0; } continue; }
    if (!m.mask[i]) continue;
    if (!inside) { clipped++; continue; }
    z.material[k] = ids[(m.material[i] ?? 1) - 1] ?? 0;
    z.shade[k] = m.shade[i] ?? 0;
    z.fixed[k] = m.shade[i] ?? 0;
    z.special[k] = m.special[i] ?? 0;
    z.part[k] = part;
    z.depth[k] = part;
    z.normal[k * 3 + 2] = 127;
  }
  return clipped;
}

export interface GridFrameInput { grid?: FrameGrid; patch?: GridPatch; fx?: 'flash' }

/** 프레임 모드 1장: 그리드 그대로 → 해석 → 외곽선(등급 모드) → 특수 칸 → fx → (예산) → 반전 → 검증 */
export function renderGridFrame(ctx: RenderContext, base: FrameGrid, f: GridFrameInput, skipBudget = false): RenderResult {
  const { spec, bible, rules, rig, palette } = ctx;
  const size = bible.sizeClasses[spec.sizeClass];
  if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${spec.sizeClass}`);
  const [W, H] = size;
  const names = Object.keys(bible.materials).sort();
  const materialId = (m: string) => names.indexOf(m) + 1;
  const [px, py] = pivotOf(base);
  const origin: [number, number] = [Math.floor(W / 2) - px, H - 1 - BOTTOM_GAP - py];
  const zone = createFrameZone(W, H);
  let clipped = writeGridInPlace(zone, f.grid ?? base, origin[0], origin[1], BASE, materialId);
  if (f.patch) clipped += writeGridInPlace(zone, f.patch, origin[0] + f.patch.at[0], origin[1] + f.patch.at[1], PATCH, materialId);
  const ramps = rampsOf(bible, palette);
  const resolved = resolveZone(zone, ramps);
  const raster: IndexedRaster = { w: W, h: H, px: resolved.px.slice() };
  const protect = new Uint8Array(W * H);
  outerOutlineInPlace(raster, zone, ramps, { mode: outlineModeOf(bible, spec.sizeClass), globalIndex: palette.outlineIndex, litThreshold: rules.outline.seloutLitThreshold }, protect);
  const eyes = applySpecialsInPlace(raster, zone, palette.outlineIndex, protect);
  if (f.fx === 'flash') applyFxInPlace(raster, { type: 'flash', color: 0 }, {}, origin, palette.fxIndices, protect);
  const exclude = [...new Set([...ramps.map((r) => r.outline), palette.outlineIndex, ...palette.fxIndices])];
  const limit = bible.colorBudget[spec.sizeClass] ?? Infinity;
  const budget = skipBudget ? noFit(raster, limit) : fitBudgetInPlace([raster], ramps, palette.palette, limit, new Set(exclude));
  const flip = bible.facing !== rig.facing;
  const final = flip ? flipX(raster) : raster;
  assertFrame(final, palette.palette);
  const layer = <T extends Uint8Array | Uint16Array>(a: T): T => (flip ? flipLayer(a, W) : a);
  return {
    raster: final, origin, clipped,
    meta: {
      budget, budgetExclude: exclude, eyes, smallParts: [], face: null, warnings: [],
      layers: { material: layer(zone.material), part: layer(zone.part), mark: layer(protect) },
      // base는 grid(전체) 프레임에서만 바뀐다 — patch 프레임끼리는 base 영역이 같아야 한다(anim.flicker)
      partTransforms: [[0, 0, 0], [0, 0, 0]],
    },
  };
}

/** 프레임 모드 전체: rest(base) + spec.frames의 애니. 색 예산은 전 프레임을 모아 한 번에(renderAnimations와 같은 규칙) */
export function renderGridAnimations(ctx: RenderContext, ids: readonly string[]): AnimRender {
  const base = ctx.spec.grid;
  if (!base || !ctx.spec.frames) throw new ForgeError('spec.invalid', '프레임 모드는 grid·frames가 필요합니다');
  const rest = renderGridFrame(ctx, base, {}, true);
  let uid = 0;
  const frames = ids.flatMap((id) => {
    const list = ctx.spec.frames?.[id];
    if (!list) throw new ForgeError('spec.refs', `프레임 모드 Spec에 없는 애니: ${id}`);
    const loop = ctx.spec.loop.includes(id);
    return list.map((f, index): AnimFrame => {
      const r = renderGridFrame(ctx, base, { ...(f.grid ? { grid: f.grid } : {}), ...(f.patch ? { patch: f.patch } : {}), ...(f.fx ? { fx: f.fx } : {}) }, true);
      uid++;
      r.meta.partTransforms = [[0, 0, f.grid ? uid : 0], [uid, 0, 0]];
      return { anim: id, index, raster: r.raster, ms: f.ms, hold: !loop && index === list.length - 1, keyName: `f${index}`, inbetween: false, rootFixed: f.grounded, clipped: r.clipped, meta: r.meta };
    });
  });
  const ramps = rampsOf(ctx.bible, ctx.palette);
  const exclude = new Set([rest, ...frames].flatMap((f) => f.meta.budgetExclude));
  const budget = fitBudgetInPlace([rest.raster, ...frames.map((f) => f.raster)], ramps, ctx.palette.palette, ctx.bible.colorBudget[ctx.spec.sizeClass] ?? Infinity, exclude);
  rest.meta.budget = budget;
  for (const f of frames) f.meta.budget = budget;
  return { rest, frames, budget };
}
