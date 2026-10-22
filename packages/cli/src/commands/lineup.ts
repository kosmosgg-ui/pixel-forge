import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError, parseHex, toRGBA, type IndexedRaster } from '@pixel-forge/core';
import { writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { decodePng, encodePng, type RgbaImage } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { parseSheetScale } from './render.js';
import { renderProject } from './qa.js';

const GAP = 4;
const DEFAULT_BG = '#1f1a24';

/** 불투명 칸의 bbox로 자른 RGBA */
function crop(img: RgbaImage): RgbaImage {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if ((img.rgba[(y * img.w + x) * 4 + 3] ?? 0) < 128) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return { w: 1, h: 1, rgba: new Uint8Array(4) };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) rgba.set(img.rgba.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4);
  return { w, h, rgba };
}

/** 항목: PNG 경로, 또는 Spec 경로[#<anim>_<dir>_<n>](생략하면 rest) */
function itemImage(item: string, cwd: string): RgbaImage {
  const [path = '', frame] = item.split('#');
  const full = resolveInside(cwd, path);
  if (path.endsWith('.png')) return decodePng(readFileSync(full));
  const r = renderProject(loadProject(full, cwd));
  let ras: IndexedRaster = r.rest.raster;
  if (frame) {
    const f = r.frames.find((g) => `${g.anim}_${g.dir ?? 'r'}_${g.index}` === frame);
    if (!f) throw new ForgeError('cli.lineup', `프레임이 없습니다: ${item}`);
    ras = f.raster;
  }
  return { w: ras.w, h: ras.h, rgba: toRGBA(ras, r.palette.palette) };
}

/**
 * 판정용 나란히 보기(art-judge): 항목마다 bbox로 잘라 같은 배율로 한 줄, 발밑을 맞춘다 → out/<…>.png.
 * 기준 이미지(docs/integrated/calibration)와 툴 결과를 같은 조건에서 비교하려는 것 — 색은 원본 그대로.
 */
export function lineupCommand(outPath: string, items: readonly string[], cwd: string, scale = 4, background = DEFAULT_BG) {
  if (!items.length) throw new ForgeError('cli.lineup', '항목이 없습니다: forge lineup <out.png> <a.png|b.spec.json[#anim_dir_n]> ...');
  const k = parseSheetScale(scale);
  const out = resolveInside(join(cwd, 'out'), resolveInside(cwd, outPath));
  const imgs = items.map((i) => crop(itemImage(i, cwd)));
  const H = Math.max(...imgs.map((i) => i.h)), W = imgs.reduce((a, i) => a + i.w + GAP, GAP);
  const [br, bg, bb] = parseHex(background);
  const ow = W * k, oh = (H + 2 * GAP) * k, rgba = new Uint8Array(ow * oh * 4);
  for (let p = 0; p < ow * oh; p++) { rgba[p * 4] = br; rgba[p * 4 + 1] = bg; rgba[p * 4 + 2] = bb; rgba[p * 4 + 3] = 255; }
  let ox = GAP;
  for (const img of imgs) {
    const oy = GAP + H - img.h;
    for (let y = 0; y < img.h * k; y++) for (let x = 0; x < img.w * k; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      if ((img.rgba[s + 3] ?? 0) < 128) continue;
      rgba.set(img.rgba.subarray(s, s + 3), ((oy * k + y) * ow + ox * k + x) * 4);
    }
    ox += img.w + GAP;
  }
  writeFileEnsured(out, encodePng({ w: ow, h: oh, rgba }));
  return { ok: true as const, cmd: 'lineup', items: items.map((i, n) => `${n + 1}:${i}`), sizes: imgs.map((i) => [i.w, i.h]), scale: k, out: relative(cwd, out) };
}
