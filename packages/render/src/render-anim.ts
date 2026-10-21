import { ForgeError, flipX, type IndexedRaster } from '@pixel-forge/core';
import { buildTimeline, isRootFixed } from '@pixel-forge/rig';
import type { AnimsFile } from '@pixel-forge/spec';
import { fitBudgetInPlace, type BudgetFitResult } from './budget-fit.js';
import { rampsOf, renderFrame, type RenderContext, type RenderMeta, type RenderResult } from './render-frame.js';

export interface AnimFrame {
  anim: string;
  /** 애니 안 순번(0부터) — 프레임 이름 <anim>_<dir>_<n> */
  index: number;
  raster: IndexedRaster;
  ms: number;
  hold: boolean;
  keyName: string;
  inbetween: boolean;
  /** root가 움직이지 않는 프레임(발밑 기준선 검사 대상) */
  rootFixed: boolean;
  /** 캔버스 밖으로 잘린 파츠 픽셀 수(크기 등급 맞춤 판정) */
  clipped: number;
  meta: RenderMeta;
}

export interface AnimRender {
  rest: RenderResult;
  frames: AnimFrame[];
  /** rest + 전 프레임 공동 색 예산 맞춤 결과 */
  budget: BudgetFitResult;
}

/**
 * rest와 애니 프레임을 모두 같은 원점(rest 기준)으로 렌더하고, 색 예산은 전 프레임을 모아 한 번에 맞춘다.
 * 그래야 발밑이 고정되고(baseline.stable) 같은 파츠 색이 프레임마다 바뀌지 않는다(anim.flicker).
 */
export function renderAnimations(ctx: RenderContext, anims: AnimsFile, ids: readonly string[]): AnimRender {
  const rest = renderFrame(ctx, { skipBudget: true });
  const root = Object.keys(ctx.rig.bones).find((n) => ctx.rig.bones[n]?.parent === null) ?? '';
  const isStrike = (fx: string) => anims.fx[fx]?.type === 'arc';
  const frames = ids.flatMap((id) => {
    const anim = anims.anims[id];
    if (!anim) throw new ForgeError('spec.refs', `공용 애니에 없는 애니: ${id}`);
    return buildTimeline(anim, ctx.rules.anim, ctx.spec.overrides[id], isStrike).map((f, index): AnimFrame => {
      const fx = f.fx === undefined ? undefined : anims.fx[f.fx];
      const r = renderFrame(ctx, { pose: f.pose, origin: rest.origin, skipBudget: true, ...(fx ? { fx } : {}) });
      return { anim: id, index, raster: r.raster, ms: f.ms, hold: f.hold, keyName: f.keyName, inbetween: f.inbetween, rootFixed: isRootFixed(f.pose, root), clipped: r.clipped, meta: r.meta };
    });
  });
  const exclude = new Set([rest, ...frames].flatMap((f) => f.meta.budgetExclude));
  const limit = ctx.bible.colorBudget[ctx.spec.sizeClass] ?? Infinity;
  const budget = fitBudgetInPlace([rest.raster, ...frames.map((f) => f.raster)], rampsOf(ctx.bible, ctx.palette), ctx.palette.palette, limit, exclude);
  rest.meta.budget = budget;
  for (const f of frames) f.meta.budget = budget;
  return { rest, frames, budget };
}

/** §8.1 좌향 = 우향 렌더 결과를 픽셀 정확하게 좌우 반전(재렌더하지 않는다) */
export function mirrorFrame(r: IndexedRaster): IndexedRaster {
  return flipX(r);
}
