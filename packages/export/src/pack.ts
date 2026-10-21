import type { IndexedRaster, Palette } from '@pixel-forge/core';
import { asepriteJson, type AsepriteJson, type SheetTag } from './format-aseprite.js';
import type { Manifest } from './manifest.js';
import { packShelf, type PackOptions } from './pack-shelf.js';

export interface PackFrame {
  anim: string;
  index: number;
  raster: IndexedRaster;
  ms: number;
}

export interface PackInput {
  id: string;
  bible: string;
  sizeClass: string;
  rest: IndexedRaster;
  /** 루트 관절의 프레임 안 x */
  rootX: number;
  frames: readonly PackFrame[];
  loops: Readonly<Record<string, boolean>>;
  motion: unknown;
  palette: Palette;
  version: string;
}

export interface PackResult {
  sheet: IndexedRaster;
  json: AsepriteJson;
  /** hash는 PNG 인코딩 뒤 io에서 채운다 */
  manifest: Omit<Manifest, 'hash'>;
}

const DIR = 'r';
/** rest(정지 1프레임)의 duration — 0이면 로더의 경과 시간 계산이 0으로 나뉜다 */
export const REST_MS = 100;
const hex = (c: number) => '#' + (c >>> 8).toString(16).padStart(6, '0');

/** rest(1프레임 태그 rest_r) + 애니 프레임을 애니 순서대로 한 시트에. 프레임 이름 <anim>_<dir>_<n>, 태그 <anim>_<dir> (§10) */
export function packCharacter(c: PackInput, image: string, o: PackOptions = {}): PackResult {
  const frames: PackFrame[] = [{ anim: 'rest', index: 0, raster: c.rest, ms: REST_MS }, ...c.frames];
  const name = (f: PackFrame) => `${f.anim}_${DIR}_${f.index}`;
  const { sheet, rects } = packShelf(frames.map((f) => ({ name: name(f), raster: f.raster })), o);
  const tags: SheetTag[] = [];
  const anims: Manifest['anims'] = {};
  frames.forEach((f, i) => {
    const last = tags[tags.length - 1];
    if (last && last.name === `${f.anim}_${DIR}`) last.to = i;
    else tags.push({ name: `${f.anim}_${DIR}`, from: i, to: i, loop: f.anim === 'rest' ? false : c.loops[f.anim] ?? false });
    const a = (anims[f.anim] ??= { frames: [], ms: [], loop: f.anim === 'rest' ? false : c.loops[f.anim] ?? false });
    a.frames.push(name(f));
    a.ms.push(f.ms);
  });
  const json = asepriteJson({
    image, size: { w: sheet.w, h: sheet.h }, version: c.version, tags,
    frames: rects.map((r, i) => ({ ...r, duration: frames[i]?.ms ?? 0 })),
  });
  const used = [...new Set(sheet.px)].filter((v) => v).sort((a, b) => a - b);
  const manifest: Omit<Manifest, 'hash'> = {
    id: c.id, bible: c.bible, sizeClass: c.sizeClass, frameSize: [c.rest.w, c.rest.h],
    pivot: [c.rootX, bottomRow(c.rest) + 1], facing: DIR, anims, motion: c.motion,
    palette: used.map((v) => hex(c.palette.colors[v] ?? 0)),
  };
  return { sheet, json, manifest };
}

function bottomRow(r: IndexedRaster): number {
  for (let k = r.px.length - 1; k >= 0; k--) if (r.px[k]) return Math.floor(k / r.w);
  return r.h - 1;
}
