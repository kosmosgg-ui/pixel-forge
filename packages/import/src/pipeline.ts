import { ForgeError, srgbToOklab } from '@pixel-forge/core';
import { placeInCell, outlineInPlace, type IndexFrame } from './align.js';
import { binarizeAlphaInPlace, removeBackgroundInPlace } from './background.js';
import { medianCut, quantize } from './palette.js';
import { alphaOf } from './probe.js';
import { dedupeRow, rowsByKmeans } from './rows.js';
import { boxDownscale } from './scale.js';
import { segmentSprites } from './segment.js';
import type { ImportWarning, RgbaImage, Sprite } from './types.js';

/** 외곽선으로 칠 만큼 어두운 색의 OKLab 명도 상한 */
const DARK_L = 0.35;

export interface ImportOptions {
  rows: readonly { anim: string; dir: string; frames?: readonly number[] }[];
  cell: { w: number; h: number; anchor: readonly [number, number] };
  alphaThreshold: number;
  dedupe: boolean;
  targetHeight?: number;
  background: 'auto' | 'none';
  /** auto = median-cut max색, 아니면 이 색 목록(바이블 팔레트 0xRRGGBB)에 최근접 */
  palette: { max: number; fixed?: readonly number[] };
  /** 외곽선 색(0xRRGGBB, 바이블 outline). 없으면 외곽선을 더하지 않는다 */
  outline?: number;
}

export interface ImportedFrame {
  anim: string;
  dir: string;
  /** 애니 안 순번(중복 제거 뒤) */
  index: number;
  frame: IndexFrame;
  /** 원본 위치: 줄·줄 안 스프라이트 순번 */
  source: { row: number; sprite: number };
}

export interface ImportResult {
  /** 팔레트 0xRRGGBB(순번 n = px 값 n+1). 외곽선색을 더했으면 끝에 */
  palette: number[];
  frames: ImportedFrame[];
  /** 애니마다 원래 프레임 → 고유 프레임 순번 */
  frameMap: Record<string, number[]>;
  warnings: ImportWarning[];
  /** 양자화 전후 평균 OKLab ΔE */
  paletteDelta: number;
  scale: number;
}

/** 줄 배치대로 스프라이트 고르기 + 잘림 경고(번호 = 줄:스프라이트) */
function pick(rows: Sprite[][], o: ImportOptions, warnings: ImportWarning[]): { anim: string; dir: string; row: number; sprites: { s: Sprite; i: number }[] }[] {
  const clipped: string[] = [];
  const out = o.rows.map((r, ri) => {
    const row = rows[ri] ?? [];
    const idx = r.frames ?? row.map((_, i) => i);
    const sprites = idx.map((i) => {
      const s = row[i];
      if (!s) throw new ForgeError('import.layout', `${ri}번 줄에 ${i}번 스프라이트가 없습니다(${row.length}개)`);
      if (s.clipped) clipped.push(`${ri}:${i}`);
      return { s, i };
    });
    return { anim: r.anim, dir: r.dir, row: ri, sprites };
  });
  if (clipped.length) warnings.push({ id: 'import.clipped', note: `이미지 가장자리에서 잘린 스프라이트: ${clipped.join(', ')}` });
  return out;
}

/**
 * 외부 이미지 → 셀에 맞춘 인덱스 프레임(사용자 승인 P8 3단계 1~8): 배경 → 이진화 → 분리 → 줄 → 고르기·잘림 → 중복 제거
 * → 공통 배율 BOX 축소 → 팔레트 → 발 앵커 정렬 → 외곽선. 순수 함수(입력 이미지는 복사해서 쓴다).
 */
export function importImage(src: RgbaImage, o: ImportOptions): ImportResult {
  const img: RgbaImage = { w: src.w, h: src.h, rgba: src.rgba.slice() };
  if (o.background === 'auto') removeBackgroundInPlace(img);
  const rawAlpha = alphaOf(img);
  binarizeAlphaInPlace(img, o.alphaThreshold);
  const warnings: ImportWarning[] = [];
  const picked = pick(rowsByKmeans(segmentSprites(img, { rawAlpha }), o.rows.length), o, warnings);
  const frameMap: Record<string, number[]> = {};
  const chosen = picked.map((p) => {
    const d = o.dedupe ? dedupeRow(p.sprites.map((x) => x.s)) : { unique: p.sprites.map((x) => x.s), frameMap: p.sprites.map((_, i) => i) };
    frameMap[`${p.anim}_${p.dir}`] = d.frameMap;
    return { ...p, unique: d.unique.map((s) => ({ s, i: p.sprites.find((x) => x.s === s)?.i ?? 0 })) };
  });
  const maxH = Math.max(...chosen.flatMap((c) => c.unique.map((u) => u.s.h)));
  const scale = o.targetHeight ? o.targetHeight / maxH : 1;
  const scaled = chosen.map((c) => ({ ...c, imgs: c.unique.map((u) => (scale === 1 ? u.s.img : boxDownscale(u.s.img, scale, o.alphaThreshold))) }));
  const palette = o.palette.fixed ? [...o.palette.fixed] : medianCut(scaled.flatMap((c) => c.imgs), o.palette.max);
  return finish(scaled, palette, o, warnings, frameMap, scale);
}

function finish(scaled: { anim: string; dir: string; row: number; unique: { s: Sprite; i: number }[]; imgs: RgbaImage[] }[], palette: number[], o: ImportOptions,
  warnings: ImportWarning[], frameMap: Record<string, number[]>, scale: number): ImportResult {
  const pal = [...palette];
  const outlineIndex = o.outline === undefined ? 0 : (pal.indexOf(o.outline) + 1 || pal.push(o.outline));
  // 명도 하위 2단계 중 실제로 어두운 색만(팔레트가 작으면 하위 2색이 밝을 수 있다)
  const darkest = new Set(palette.slice(0, 2).flatMap((c, i) => (srgbToOklab(c >> 16, (c >> 8) & 255, c & 255).L < DARK_L ? [i + 1] : [])));
  let delta = 0, count = 0;
  const oversize: string[] = [];
  const frames = scaled.flatMap((c) => c.imgs.map((im, index): ImportedFrame => {
    const q = quantize(im, palette);
    delta += q.delta; count += q.count;
    const placed = placeInCell({ w: im.w, h: im.h, px: q.px }, o.cell.w, o.cell.h, o.cell.anchor);
    if (placed.outside) oversize.push(`${c.anim}_${c.dir}_${index}(${placed.outside}px)`);
    if (outlineIndex) outlineInPlace(placed.frame, darkest, outlineIndex);
    return { anim: c.anim, dir: c.dir, index, frame: placed.frame, source: { row: c.row, sprite: c.unique[index]?.i ?? 0 } };
  }));
  if (oversize.length) throw new ForgeError('import.oversize', `셀 ${o.cell.w}×${o.cell.h}보다 큰 프레임 ${oversize.join(', ')} — 축소하지 않는다(targetHeight·셀 크기는 사용자가 정한다)`);
  return { palette: pal, frames, frameMap, warnings, paletteDelta: count ? delta / count : 0, scale };
}
