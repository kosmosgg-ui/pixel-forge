import { ForgeError, srgbToOklab } from '@pixel-forge/core';
import { grownCell, outlineInPlace, placeInCell, ringStats, seloutInPlace, type IndexFrame } from './align.js';
import { binarizeAlphaInPlace, cornerBackground, despillEdgesInPlace, removeBackgroundInPlace } from './background.js';
import { cleanupFramesInPlace, type CleanupStats } from './cleanup.js';
import { medianCut, quantize } from './palette.js';
import { dedupeRow, rowsByKmeans } from './rows.js';
import { boxDownscale } from './scale.js';
import { segmentSprites } from './segment.js';
import type { ImportWarning, RgbaImage, Sprite } from './types.js';

/** 외곽선으로 칠 만큼 어두운 색의 OKLab 명도 상한 */
const DARK_L = 0.35;
/** 둘레의 이 비율 이상이 이미 어두우면 외곽선을 더하지 않는다(INSTRUCTIONS P8 3-7) */
const OUTLINE_SKIP_RATIO = 0.7;

export interface ImportOptions {
  /** row = 이미지 줄 번호(한 줄에 애니 여러 개일 때). 생략하면 layout 순번 */
  rows: readonly { anim: string; dir: string; row?: number; frames?: readonly number[] }[];
  cell: { w: number; h: number; anchor: readonly [number, number] };
  alphaThreshold: number;
  dedupe: boolean;
  targetHeight?: number;
  background: 'auto' | 'none';
  /** auto = median-cut max색, 아니면 이 색 목록(바이블 팔레트 0xRRGGBB)에 최근접 */
  palette: { max: number; fixed?: readonly number[] };
  /** 외곽선 색(0xRRGGBB, 바이블 outline). 없으면 외곽선을 더하지 않는다 */
  outline?: number;
  /** ring = 실루엣 밖 1px 고리(바이블 dark), selout = 바깥 경계를 같은 계열 어두운 색으로(바이블 selout, P10 1절 — 실루엣 크기 그대로) */
  outlineMode?: 'ring' | 'selout';
  /** 정리 개선(P10 2.4): 배경 색조 잔여 제거·붙은 단계 병합·외톨이 흡수 */
  cleanup?: boolean;
  /**
   * 크기 보정(G2 U1 scaleAnchor): 첫 줄의 이 스프라이트(서 있는 프레임)의 키 → targetHeight로 공통 배율을 정한다.
   * 원본마다 그려진 크기가 달라도(보드 death는 0.67배) 서 있는 키가 같아진다. 생략하면 가장 큰 프레임 키.
   */
  scaleAnchorFrame?: number;
  /** 크기 보정 일반형(G2 U3 동작 시트): layout 줄 row의 frame번 스프라이트의 키(h) 또는 몸길이(w)를 size px로. targetHeight보다 우선 */
  scaleAnchor?: { row: number; frame: number; axis: 'h' | 'w'; size: number };
  /** 정리(cleanup)에서 지울 색상 범위(HSV 도, 예: 마젠타 배경의 분홍 잡티 280~320) — 원화 팔레트에 없는 계열만 */
  dropHue?: readonly [number, number];
  /** 무기 붉은 기 → 금속 회색(옵션, 피 얼룩 제거) */
  redToMetal?: boolean;
  /** 셀보다 큰 프레임이 있으면 셀을 넓힌다(오류 대신 — 동작 시트 후보, 사용자 확인 대상) */
  cellGrow?: boolean;
  /** 내부: 배경 키 색(despill용, importImage가 채운다) */
  keyColor?: readonly [number, number, number] | null;
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
  cleanup?: CleanupStats;
  /** cellGrow로 넓힌 셀(넓히지 않았으면 없음) */
  cell?: { w: number; h: number; anchor: [number, number] };
}

/**
 * 크기 기준 스프라이트로 정한 '가장 큰 키' 대용값: 배율 = targetHeight / 반환값 = size / (기준 스프라이트 h 또는 w).
 * 기준이 없으면 undefined(가장 큰 프레임 키를 쓴다).
 */
function anchorMaxH(picked: { sprites: { s: Sprite }[] }[], o: ImportOptions): number | undefined {
  const a = o.scaleAnchor ?? (o.scaleAnchorFrame !== undefined && o.targetHeight ? { row: 0, frame: o.scaleAnchorFrame, axis: 'h' as const, size: o.targetHeight } : undefined);
  if (!a) return undefined;
  const s = picked[a.row]?.sprites[a.frame]?.s;
  if (!s) throw new ForgeError('import.scale-anchor', `크기 기준 프레임이 없습니다: 줄 ${a.row} · ${a.frame}번`);
  return ((a.axis === 'w' ? s.w : s.h) * (o.targetHeight ?? a.size)) / a.size;
}

/** 이미지 줄 수 = layout row 번호 최댓값 + 1 */
const imageRows = (o: Pick<ImportOptions, 'rows'>) => 1 + Math.max(...o.rows.map((r, li) => r.row ?? li));

/** 줄 배치대로 스프라이트 고르기 + 잘림 경고(번호 = 줄:스프라이트) */
function pick(rows: Sprite[][], o: ImportOptions, warnings: ImportWarning[]): { anim: string; dir: string; row: number; sprites: { s: Sprite; i: number }[] }[] {
  const clipped: string[] = [];
  const out = o.rows.map((r, li) => {
    const ri = r.row ?? li;
    const row = rows[ri] ?? [];
    const idx = r.frames ?? row.map((_, i) => i);
    const sprites = idx.map((i) => {
      const s = row[i];
      if (!s) throw new ForgeError('import.layout', `${ri}번 줄에 ${i}번 스프라이트가 없습니다(${row.length}개)`);
      if (s.clipped) clipped.push(`${ri}:${i}(${(s.edges ?? []).join('·')})`);
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
  const bgRgb = o.background === 'auto' ? cornerBackground(img) : null;
  if (o.background === 'auto') removeBackgroundInPlace(img);
  binarizeAlphaInPlace(img, o.alphaThreshold);
  const warnings: ImportWarning[] = [];
  const picked = pick(rowsByKmeans(segmentSprites(img), imageRows(o)), o, warnings);
  const frameMap: Record<string, number[]> = {};
  const chosen = picked.map((p) => {
    const d = o.dedupe ? dedupeRow(p.sprites.map((x) => x.s)) : { unique: p.sprites.map((x) => x.s), frameMap: p.sprites.map((_, i) => i) };
    frameMap[`${p.anim}_${p.dir}`] = d.frameMap;
    return { ...p, unique: d.unique.map((s) => ({ s, i: p.sprites.find((x) => x.s === s)?.i ?? 0 })) };
  });
  const maxH = anchorMaxH(picked, o) ?? Math.max(...chosen.flatMap((c) => c.unique.map((u) => u.s.h)));
  // 크기 기준만 있고 targetHeight가 없으면 기준 크기를 목표로(배율 = size / 기준 스프라이트 h·w)
  o = { ...o, keyColor: bgRgb, ...(o.targetHeight === undefined && o.scaleAnchor ? { targetHeight: o.scaleAnchor.size } : {}) };
  const first = withCleanup(scaleQuantize(chosen, o, maxH, o.targetHeight, o.cell.anchor, warnings, frameMap), o, bgRgb);
  if (o.outline !== undefined && o.outlineMode === 'selout') {
    // 48px 실루엣 분리(P10 1절): 이미 어두운 선이 있어도 축소로 흐려진 경계를 항상 다시 세운다
    const darker = darkerPairs(first.palette);
    for (const f of first.frames) seloutInPlace(f.frame, darker);
    return first;
  }
  if (o.outline === undefined || !needsOutline(first)) return first;
  // 외곽선은 실루엣을 위아래 1px씩 키운다 → 키 targetHeight·발 앵커 y를 지키게 2px 작게 줄이고 1px 위에 놓은 뒤 둘레 전체에(프레임마다 따로 정하면 깜빡인다)
  const anchor: readonly [number, number] = [o.cell.anchor[0], o.cell.anchor[1] - 1];
  const r = withCleanup(o.targetHeight ? scaleQuantize(chosen, o, maxH, o.targetHeight - 2, anchor, warnings, frameMap) : scaleQuantize(chosen, o, maxH, undefined, anchor, warnings, frameMap), o, bgRgb);
  const palette = [...r.palette];
  const outlineIndex = palette.indexOf(o.outline) + 1 || palette.push(o.outline);
  for (const f of r.frames) outlineInPlace(f.frame, outlineIndex);
  return { ...r, palette };
}

/** 팔레트 색마다 어두운 짝: 명도 0.45배·같은 a·b에 가장 가까운, 자기보다 어두운 색(없으면 가장 어두운 색) — 인덱스 1부터 */
function darkerPairs(palette: readonly number[]): number[] {
  const lab = palette.map((c) => srgbToOklab(c >> 16, (c >> 8) & 255, c & 255));
  const darkest = lab.reduce((best, l, i) => (l.L < (lab[best]?.L ?? 1) ? i : best), 0);
  return lab.map((p) => {
    let best = -1, bd = Infinity;
    lab.forEach((q, j) => {
      if (q.L >= p.L - 0.05) return;
      const d = (q.L - p.L * 0.45) ** 2 + (q.a - p.a) ** 2 + (q.b - p.b) ** 2;
      if (d < bd) { bd = d; best = j; }
    });
    return (best < 0 ? darkest : best) + 1;
  });
}

function withCleanup(r: ImportResult, o: ImportOptions, bg: readonly [number, number, number] | null): ImportResult {
  if (!o.cleanup) return r;
  const stats = cleanupFramesInPlace(r.frames.map((f) => f.frame), r.palette, { background: bg ? (bg[0] << 16) | (bg[1] << 8) | bg[2] : null, ...(o.dropHue ? { dropHue: o.dropHue } : {}), ...(o.redToMetal ? { redToMetal: true } : {}) });
  return { ...r, cleanup: stats };
}

type Chosen = { anim: string; dir: string; row: number; unique: { s: Sprite; i: number }[] }[];

/** 이미 어두운 테두리가 있는가: 모든 프레임 둘레의 70% 이상이 명도 하위 2단계 중 실제로 어두운 색 */
function needsOutline(r: ImportResult): boolean {
  const darkest = new Set(r.palette.slice(0, 2).flatMap((c, i) => (srgbToOklab(c >> 16, (c >> 8) & 255, c & 255).L < DARK_L ? [i + 1] : [])));
  let ring = 0, dark = 0;
  for (const f of r.frames) { const s = ringStats(f.frame, darkest); ring += s.ring; dark += s.dark; }
  return ring > 0 && dark < ring * OUTLINE_SKIP_RATIO;
}

/** 공통 배율(가장 큰 프레임 키 → height) BOX 축소 → 팔레트 → 셀에 발 앵커 정렬 */
function scaleQuantize(chosen: Chosen, o: ImportOptions, maxH: number, height: number | undefined, anchor: readonly [number, number],
  warnings: ImportWarning[], frameMap: Record<string, number[]>): ImportResult {
  const scale = height ? height / maxH : 1;
  const scaled = chosen.map((c) => ({ ...c, imgs: c.unique.map((u) => (scale === 1 ? u.s.img : boxDownscale(u.s.img, scale, o.alphaThreshold))) }));
  // 축소 뒤 가장자리 2px 배경 번짐 빼기(정리 옵션과 함께 — 분홍·연두 테두리)
  if (o.cleanup && o.keyColor) for (const c of scaled) for (const im of c.imgs) despillEdgesInPlace(im, o.keyColor, 2);
  const palette = o.palette.fixed ? [...o.palette.fixed] : medianCut(scaled.flatMap((c) => c.imgs), o.palette.max);
  return place(scaled, palette, o, anchor, warnings, frameMap, scale);
}

function place(scaled: { anim: string; dir: string; row: number; unique: { s: Sprite; i: number }[]; imgs: RgbaImage[] }[], palette: number[], o: ImportOptions,
  anchor: readonly [number, number], warnings: ImportWarning[], frameMap: Record<string, number[]>, scale: number): ImportResult {
  let delta = 0, count = 0;
  const qs = scaled.map((c) => c.imgs.map((im) => { const q = quantize(im, palette); delta += q.delta; count += q.count; return { w: im.w, h: im.h, px: q.px }; }));
  // 넓힌 셀: 외곽선 때문에 위로 옮긴 앵커(anchor − cell.anchor)는 그대로 유지
  const grown = o.cellGrow ? grownCell(qs.flat(), o.cell) : undefined;
  const cell = grown ?? o.cell, at: readonly [number, number] = grown ? [grown.anchor[0], grown.anchor[1] + anchor[1] - o.cell.anchor[1]] : anchor;
  const oversize: string[] = [];
  const frames = scaled.flatMap((c, ci) => c.imgs.map((_, index): ImportedFrame => {
    const placed = placeInCell(qs[ci]?.[index] ?? { w: 1, h: 1, px: new Uint8Array(1) }, cell.w, cell.h, at);
    if (placed.outside) oversize.push(`${c.anim}_${c.dir}_${index}(${placed.outside}px)`);
    return { anim: c.anim, dir: c.dir, index, frame: placed.frame, source: { row: c.row, sprite: c.unique[index]?.i ?? 0 } };
  }));
  if (oversize.length) throw new ForgeError('import.oversize', `셀 ${cell.w}×${cell.h}보다 큰 프레임 ${oversize.join(', ')} — 축소하지 않는다(targetHeight·셀 크기는 사용자가 정한다)`);
  return { palette: [...palette], frames, frameMap: { ...frameMap }, warnings: [...warnings], paletteDelta: count ? delta / count : 0, scale, ...(grown && (grown.w !== o.cell.w || grown.h !== o.cell.h) ? { cell: grown } : {}) };
}

/**
 * 원본 줄의 스프라이트 키(배경 제거·이진화 뒤, 원본 px) — 크기 보정 기록용(qa.scaleAnchor: 크기 기준 이미지 대비 몇 배로 그려졌나).
 * importImage와 같은 분리 단계를 쓴다.
 */
export function sourceHeights(src: RgbaImage, o: Pick<ImportOptions, 'rows' | 'alphaThreshold' | 'background'>): number[][] {
  const img: RgbaImage = { w: src.w, h: src.h, rgba: src.rgba.slice() };
  if (o.background === 'auto') removeBackgroundInPlace(img);
  binarizeAlphaInPlace(img, o.alphaThreshold);
  return rowsByKmeans(segmentSprites(img), imageRows(o)).map((row) => row.map((s) => s.h));
}
