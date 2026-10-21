import { flipX, ForgeError, mergeSmallClustersInPlace, removeOrphansInPlace, type BiblePalette, type IndexedRaster, type Ramp } from '@pixel-forge/core';
import { solveRig, type Pose } from '@pixel-forge/rig';
import type { Bible, Rig, Rules, Spec } from '@pixel-forge/spec';
import { assertFrame } from './assert.js';
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

export interface RenderResult {
  raster: IndexedRaster;
  origin: [number, number];
  /** 캔버스 밖으로 잘린 픽셀 수 */
  clipped: number;
  debug?: { zone: FrameZone; resolved: IndexedRaster };
}

/** P2~P4는 side 시점 character만 */
export function assertImplemented(spec: Spec, bible: Bible): void {
  if (spec.kind !== 'character') throw new ForgeError('spec.kind-not-implemented', `아직 구현되지 않은 kind: ${spec.kind}`);
  if (bible.view !== 'side') throw new ForgeError('bible.view-not-implemented', `아직 구현되지 않은 view: ${bible.view}`);
}

const BOTTOM_GAP = 2;

/** §6 단계 1~9 */
export function renderFrame(ctx: RenderContext, opts: RenderOptions = {}): RenderResult {
  const { spec, bible, rules, rig, palette } = ctx;
  assertImplemented(spec, bible);
  const size = bible.sizeClasses[spec.sizeClass];
  if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${spec.sizeClass}`);
  const [W, H] = size;
  const names = Object.keys(bible.materials).sort();
  const rampsById: Ramp[] = names.map((n) => palette.ramps[n] ?? { id: n, indices: [], outline: 0 });
  // 1~3. 포즈 해석 → 파츠 배치 → 래스터화
  const bones = solveRig(rig, (spec.proportions.height ?? rig.baseHeight) / rig.baseHeight, opts.pose);
  const placed = placeParts(spec, rig, bones);
  const rasters = placed.map((p) => rasterizePart(p, (m) => names.indexOf(m) + 1));
  const [, , , maxY] = partsBounds(rasters);
  const origin: [number, number] = opts.origin ? [opts.origin[0], opts.origin[1]] : [Math.floor(W / 2) - (bones[boneRoot(rig)]?.x ?? 0), H - 1 - BOTTOM_GAP - maxY];
  const zone = createFrameZone(W, H);
  let clipped = 0;
  placed.forEach((p, i) => { const r = rasters[i]; if (r) clipped += writePartInPlace(zone, p, r, origin[0], origin[1]); });
  // 4~5. 셰이딩 → 작은 shade 섬 정리
  shadeZoneInPlace(zone, bible.light, rules.shade, (m) => rampsById[m - 1]?.indices.length ?? 1);
  mergeSmallClustersInPlace(zone, rules.cleanup.minCluster);
  // 6~8. 해석 → 외곽선 → 정리
  const resolved = resolveZone(zone, rampsById);
  const raster: IndexedRaster = { w: resolved.w, h: resolved.h, px: resolved.px.slice() };
  const protect = new Uint8Array(W * H);
  if (rules.outline.innerLines) innerLinesInPlace(raster, zone, rampsById, protect);
  // 외곽선 모드는 게임별 화풍이므로 바이블이 규칙 기본값보다 우선
  outerOutlineInPlace(raster, zone, rampsById, { mode: bible.outline.mode, globalIndex: palette.outlineIndex, litThreshold: rules.outline.seloutLitThreshold }, protect);
  if (rules.cleanup.removeOrphans) removeOrphansInPlace(raster, new Set(), protect);
  const final = bible.facing === rig.facing ? raster : flipX(raster);
  // 9. 검증 훅
  if (opts.assert !== false) assertFrame(final, palette.palette);
  return { raster: final, origin, clipped, ...(opts.debug ? { debug: { zone, resolved } } : {}) };
}

function boneRoot(rig: Rig): string {
  return Object.keys(rig.bones).find((n) => rig.bones[n]?.parent === null) ?? '';
}
