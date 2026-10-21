import { flipX, ForgeError, mergeSmallClustersInPlace, removeOrphansInPlace, type BiblePalette, type IndexedRaster, type Ramp } from '@pixel-forge/core';
import { solveRig, type Pose } from '@pixel-forge/rig';
import type { Bible, Rig, Rules, Spec } from '@pixel-forge/spec';
import { assertFrame } from './assert.js';
import { fitBudgetInPlace, type BudgetFitResult } from './budget-fit.js';
import { drawEyesInPlace, faceStats } from './eyes.js';
import { createFrameZone, type FrameZone } from './frame-zone.js';
import { innerLinesInPlace, outerOutlineInPlace } from './outline.js';
import { placeParts } from './place.js';
import { rasterizePart } from './rasterize-part.js';
import { resolveZone } from './resolve.js';
import { shadeZoneInPlace } from './shade.js';
import { partsBounds, writePartInPlace } from './zone.js';

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
  /** 검증 훅 (§6.9) */
  assert?: boolean;
  debug?: boolean;
}

export interface RenderMeta {
  budget: BudgetFitResult;
  /** 눈 픽셀 위치(최종 캔버스 기준, 좌우 반전 전) */
  eyes: number[];
  /** 면적이 작아 3단계로 줄인 파츠의 spec.parts 순번 */
  smallParts: number[];
  /** form.face-clear 재료(eyes 없으면 null) */
  face: { area: number; covered: number } | null;
  /** QA용 픽셀 레이어(최종 캔버스 기준): 재질 id, 파츠 id(spec.parts 순번+1), 외곽선·내부선·눈 표시 */
  layers: { material: Uint8Array; part: Uint16Array; mark: Uint8Array };
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

function canvasOf(spec: Spec, bible: Bible): [number, number] {
  const size = bible.sizeClasses[spec.sizeClass];
  if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${spec.sizeClass}`);
  return size;
}

/** §6 단계 1~9 (+ 눈, 6.5 색 예산 맞춤) */
export function renderFrame(ctx: RenderContext, opts: RenderOptions = {}): RenderResult {
  const { spec, bible, rules, rig, palette } = ctx;
  assertImplemented(spec, bible);
  const [W, H] = canvasOf(spec, bible);
  const names = Object.keys(bible.materials).sort();
  const rampsById: Ramp[] = names.map((n) => palette.ramps[n] ?? { id: n, indices: [], outline: 0 });
  // 1~3. 포즈 해석 → 파츠 배치 → 래스터화
  const bones = solveRig(rig, (spec.proportions.height ?? rig.baseHeight) / rig.baseHeight, opts.pose);
  const placed = placeParts(spec, rig, bones);
  const rasters = placed.map((p) => rasterizePart(p, (m) => names.indexOf(m) + 1));
  const [, , , maxY] = partsBounds(rasters);
  const root = Object.keys(rig.bones).find((n) => rig.bones[n]?.parent === null) ?? '';
  const origin: [number, number] = opts.origin ? [opts.origin[0], opts.origin[1]] : [Math.floor(W / 2) - (bones[root]?.x ?? 0), H - 1 - BOTTOM_GAP - maxY];
  const zone = createFrameZone(W, H);
  let clipped = 0;
  const small = new Set<number>();
  placed.forEach((p, i) => {
    const r = rasters[i];
    if (!r) return;
    clipped += writePartInPlace(zone, p, r, origin[0], origin[1]);
    if (r.mask.reduce((a, v) => a + v, 0) < rules.budgetFit.smallPartArea) small.add(p.index + 1);
  });
  // 4~5. 셰이딩 → 작은 shade 섬 정리
  shadeZoneInPlace(zone, bible.light, rules.shade, (m) => rampsById[m - 1]?.indices.length ?? 1, (id) => small.has(id));
  mergeSmallClustersInPlace(zone, rules.cleanup.minCluster);
  // 6~8. 해석 → 외곽선 → 눈 → 정리
  const resolved = resolveZone(zone, rampsById);
  const raster: IndexedRaster = { w: resolved.w, h: resolved.h, px: resolved.px.slice() };
  const protect = new Uint8Array(W * H);
  if (rules.outline.innerLines) innerLinesInPlace(raster, zone, rampsById, protect);
  // 외곽선 모드는 게임별 화풍이므로 바이블이 규칙 기본값보다 우선
  outerOutlineInPlace(raster, zone, rampsById, { mode: bible.outline.mode, globalIndex: palette.outlineIndex, litThreshold: rules.outline.seloutLitThreshold }, protect);
  const eyes = drawEyesInPlace(raster, zone, spec, rig, bones, palette.ramps, origin, rules.face.farEyeGap, protect);
  if (rules.cleanup.removeOrphans) removeOrphansInPlace(raster, new Set(), protect);
  // 6.5 색 예산 맞춤: 외곽선 톤도 예산에 들어가므로 외곽선·눈을 그린 뒤 센다
  const exclude = new Set([...rampsById.map((r) => r.outline), palette.outlineIndex, ...palette.fxIndices, ...(eyes ? [eyes.colorIndex] : [])]);
  const budget = fitBudgetInPlace(raster, rampsById, palette.palette, bible.colorBudget[spec.sizeClass] ?? Infinity, exclude);
  const flip = bible.facing !== rig.facing;
  const final = flip ? flipX(raster) : raster;
  // 9. 검증 훅
  if (opts.assert !== false) assertFrame(final, palette.palette);
  const face = faceStats(zone, spec, rasters, placed.map((p) => p.index), origin);
  const layer = <T extends Uint8Array | Uint16Array>(a: T): T => (flip ? flipLayer(a, W) : a);
  const meta: RenderMeta = {
    budget, eyes: eyes?.pixels ?? [], smallParts: [...small].map((id) => id - 1).sort((a, b) => a - b), face,
    layers: { material: layer(zone.material), part: layer(zone.part), mark: layer(protect) },
  };
  return { raster: final, origin, clipped, meta, ...(opts.debug ? { debug: { zone, resolved } } : {}) };
}
