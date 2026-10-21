import { flipX, ForgeError, mergeSmallClustersInPlace, removeOrphansInPlace, type BiblePalette, type IndexedRaster, type Ramp } from '@pixel-forge/core';
import { solveRig, type BoneWorld, type Pose } from '@pixel-forge/rig';
import type { Bible, FxDef, Rig, Rules, Spec } from '@pixel-forge/spec';
import { assertFrame } from './assert.js';
import { fitBudgetInPlace, type BudgetFitResult } from './budget-fit.js';
import { drawEyesInPlace, faceStats } from './eyes.js';
import { createFrameZone, type FrameZone } from './frame-zone.js';
import { applyFxInPlace } from './fx.js';
import { innerLinesInPlace, isThinMask, outerOutlineInPlace, thinStrokesInPlace } from './outline.js';
import { placeParts, type PlacedPart } from './place.js';
import { rasterizePart, type PartRaster } from './rasterize-part.js';
import { resolveZone } from './resolve.js';
import { shadeZoneInPlace } from './shade.js';
import { partsBounds, partZone, writePartInPlace } from './zone.js';

export interface RenderContext {
  spec: Spec;
  bible: Bible;
  rules: Rules;
  rig: Rig;
  palette: BiblePalette;
}

export interface RenderOptions {
  pose?: Pose;
  /** 월드 → 캔버스 이동량. 없으면 이 프레임 기준(루트는 가로 가운데, 발밑은 바닥에서 외곽선 1px + 여백 1px 위) */
  origin?: readonly [number, number];
  /** 이 프레임에 얹을 fx 레이어 */
  fx?: FxDef;
  /** 색 예산 맞춤을 건너뛴다 — 애니 전 프레임을 모아 한 번에 맞출 때 */
  skipBudget?: boolean;
  /** 검증 훅 (§6.9) */
  assert?: boolean;
  debug?: boolean;
}

export interface RenderMeta {
  budget: BudgetFitResult;
  /** 예산 병합에서 빼야 할 색(외곽선 톤·예약 색·눈 색) */
  budgetExclude: number[];
  /** 눈 픽셀 위치(최종 캔버스 기준, 좌우 반전 전) */
  eyes: number[];
  /** 면적이 작아 3단계로 줄인 파츠의 spec.parts 순번 */
  smallParts: number[];
  /** form.face-clear 재료(eyes 없으면 null) */
  face: { area: number; covered: number } | null;
  /** QA용 픽셀 레이어(최종 캔버스 기준): 재질 id, 파츠 id(spec.parts 순번+1), 외곽선·내부선·눈·fx 표시 */
  layers: { material: Uint8Array; part: Uint16Array; mark: Uint8Array };
  /** spec.parts 순번별 [x, y, angle] — 프레임 간 같은 변환인 파츠 판정(anim.flicker) */
  partTransforms: [number, number, number][];
}

export interface RenderResult {
  raster: IndexedRaster;
  origin: [number, number];
  /** 캔버스 밖으로 잘린 픽셀 수 */
  clipped: number;
  meta: RenderMeta;
  debug?: { zone: FrameZone; resolved: IndexedRaster };
}

/** P2~P4는 side 시점 character만 */
export function assertImplemented(spec: Spec, bible: Bible): void {
  if (spec.kind !== 'character') throw new ForgeError('spec.kind-not-implemented', `아직 구현되지 않은 kind: ${spec.kind}`);
  if (bible.view !== 'side') throw new ForgeError('bible.view-not-implemented', `아직 구현되지 않은 view: ${bible.view}`);
}

const BOTTOM_GAP = 2;

function flipLayer<T extends Uint8Array | Uint16Array>(a: T, w: number): T {
  const out = a.slice() as T;
  for (let i = 0; i < a.length; i++) out[i] = a[i - (i % w) + (w - 1 - (i % w))] ?? 0;
  return out;
}

export function rampsOf(bible: Bible, palette: BiblePalette): Ramp[] {
  return Object.keys(bible.materials).sort().map((n) => palette.ramps[n] ?? { id: n, indices: [], outline: 0 });
}

interface Layout {
  bones: Record<string, BoneWorld>;
  placed: PlacedPart[];
  rasters: PartRaster[];
  origin: [number, number];
  zone: FrameZone;
  clipped: number;
  small: Set<number>;
  thin: Set<number>;
}

/**
 * §6 1~5: 포즈 해석 → 파츠 배치 → 래스터화 → 파츠별 셰이딩·작은 섬 정리 → zone 기록.
 * 셰이딩·정리를 파츠 단위(가려지기 전 전체 모양)로 하므로 다른 파츠가 움직이거나 가려도 이 파츠 음영은 그대로다(anim.flicker).
 */
function layoutFrame(ctx: RenderContext, opts: RenderOptions, W: number, H: number, rampsById: readonly Ramp[]): Layout {
  const { spec, bible, rules, rig } = ctx;
  const names = Object.keys(bible.materials).sort();
  const scale = (spec.proportions.height ?? rig.baseHeight) / rig.baseHeight;
  const bones = solveRig(rig, scale, opts.pose);
  const placed = placeParts(spec, rig, bones, opts.pose ? solveRig(rig, scale) : bones);
  const rasters = placed.map((p) => rasterizePart(p, (m) => names.indexOf(m) + 1));
  const [, , , maxY] = partsBounds(rasters);
  const root = Object.keys(rig.bones).find((n) => rig.bones[n]?.parent === null) ?? '';
  const origin: [number, number] = opts.origin ? [opts.origin[0], opts.origin[1]] : [Math.floor(W / 2) - (bones[root]?.x ?? 0), H - 1 - BOTTOM_GAP - maxY];
  const zone = createFrameZone(W, H);
  let clipped = 0;
  const small = new Set<number>(), thin = new Set<number>();
  const stepsOf = (m: number) => rampsById[m - 1]?.indices.length ?? 1;
  placed.forEach((p, i) => {
    const r = rasters[i];
    if (!r) return;
    if (r.mask.reduce((a, v) => a + v, 0) < rules.budgetFit.smallPartArea) small.add(p.index + 1);
    if (isThinMask(r.mask, r.w, r.h)) thin.add(p.index + 1);
    const local = partZone(p, r);
    shadeZoneInPlace(local, bible.light, rules.shade, stepsOf, (id) => small.has(id));
    mergeSmallClustersInPlace(local, rules.cleanup.minCluster);
    clipped += writePartInPlace(zone, p, r, origin[0], origin[1], local);
  });
  return { bones, placed, rasters, origin, zone, clipped, small, thin };
}

/** §6 단계 1~9 (+ 눈, fx, 6.5 색 예산 맞춤) */
export function renderFrame(ctx: RenderContext, opts: RenderOptions = {}): RenderResult {
  const { spec, bible, rules, rig, palette } = ctx;
  assertImplemented(spec, bible);
  const size = bible.sizeClasses[spec.sizeClass];
  if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${spec.sizeClass}`);
  const [W, H] = size;
  const rampsById = rampsOf(bible, palette);
  const L = layoutFrame(ctx, opts, W, H, rampsById);
  const { zone, thin, origin } = L;
  // 6~8. 해석 → 외곽선(얇은 획 포함) → 눈 → fx → 정리
  const resolved = resolveZone(zone, rampsById);
  const raster: IndexedRaster = { w: resolved.w, h: resolved.h, px: resolved.px.slice() };
  const protect = new Uint8Array(W * H);
  // 8. 고립 픽셀 정리는 선을 긋기 전, 파츠 자기 색만으로 판정한다 — 움직이는 이웃 때문에 바뀌는 내부선이
  //    정지한 파츠의 정리 결과로 번지면 깜빡인다(anim.flicker)
  if (rules.cleanup.removeOrphans) removeOrphansInPlace(raster, new Set(), undefined, zone.part);
  if (rules.outline.innerLines) innerLinesInPlace(raster, zone, rampsById, protect, thin);
  // 외곽선 모드는 게임별 화풍이므로 바이블이 규칙 기본값보다 우선
  outerOutlineInPlace(raster, zone, rampsById, { mode: bible.outline.mode, globalIndex: palette.outlineIndex, litThreshold: rules.outline.seloutLitThreshold }, protect, thin);
  thinStrokesInPlace(raster, zone, rampsById, thin, protect);
  const eyes = drawEyesInPlace(raster, zone, spec, rig, L.bones, palette.ramps, origin, rules.face.farEyeGap, protect);
  if (opts.fx) applyFxInPlace(raster, opts.fx, L.bones, origin, palette.fxIndices, protect);
  // 6.5 색 예산 맞춤: 외곽선 톤도 예산에 들어가므로 외곽선·눈을 그린 뒤 센다
  const exclude = [...new Set([...rampsById.map((r) => r.outline), palette.outlineIndex, ...palette.fxIndices, ...(eyes ? [eyes.colorIndex] : [])])];
  const limit = bible.colorBudget[spec.sizeClass] ?? Infinity;
  const budget = opts.skipBudget ? noFit(raster, limit) : fitBudgetInPlace([raster], rampsById, palette.palette, limit, new Set(exclude));
  const flip = bible.facing !== rig.facing;
  const final = flip ? flipX(raster) : raster;
  // 9. 검증 훅
  if (opts.assert !== false) assertFrame(final, palette.palette);
  const layer = <T extends Uint8Array | Uint16Array>(a: T): T => (flip ? flipLayer(a, W) : a);
  const partTransforms: [number, number, number][] = spec.parts.map(() => [0, 0, 0]);
  for (const p of L.placed) partTransforms[p.index] = [p.x, p.y, p.angle];
  const meta: RenderMeta = {
    budget, budgetExclude: exclude, eyes: eyes?.pixels ?? [], smallParts: [...L.small].map((id) => id - 1).sort((a, b) => a - b),
    face: faceStats(zone, spec, L.rasters, L.placed.map((p) => p.index), origin),
    layers: { material: layer(zone.material), part: layer(zone.part), mark: layer(protect) }, partTransforms,
  };
  return { raster: final, origin, clipped: L.clipped, meta, ...(opts.debug ? { debug: { zone, resolved } } : {}) };
}

function noFit(r: IndexedRaster, limit: number): BudgetFitResult {
  const used = new Set(r.px);
  used.delete(0);
  return { limit, before: used.size, after: used.size, merges: [] };
}
