import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import type { FxAsset } from '@pixel-forge/spec';
import { decodePng, type RgbaImage } from '../io/png.js';

/** 8방향 행(오른쪽부터 시계 방향 45° — sg_fx.px.js eightWay와 같은 순서) */
export const FX_DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;

export interface FxRow { name: string; frames: RgbaImage[]; ms: number[] }

function crop(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const rgba = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) rgba.set(img.rgba.subarray(((y + r) * img.w + x) * 4, ((y + r) * img.w + x + w) * 4), r * w * 4);
  return { w, h, rgba };
}

/** pxl anim 스트립(out/anims/<n>.png + .json 프레임 좌표·duration) */
function strip(out: string, name: string): { frames: RgbaImage[]; ms: number[] } {
  const png = join(out, 'anims', `${name}.png`), meta = join(out, 'anims', `${name}.json`);
  if (!existsSync(png) || !existsSync(meta)) throw new ForgeError('fx.missing', `pxl 산출이 없습니다: anims/${name}`);
  const img = decodePng(readFileSync(png));
  const json = JSON.parse(readFileSync(meta, 'utf8')) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration: number }> };
  const list = Object.entries(json.frames).sort(([a], [b]) => Number(a.split('_').pop()) - Number(b.split('_').pop())).map(([, f]) => f);
  return { frames: list.map((f) => crop(img, f.frame.x, f.frame.y, f.frame.w, f.frame.h)), ms: list.map((f) => f.duration) };
}

function sprite(out: string, name: string): RgbaImage {
  const png = join(out, 'sprites', `${name}.png`);
  if (!existsSync(png)) throw new ForgeError('fx.missing', `pxl 산출이 없습니다: sprites/${name}`);
  return decodePng(readFileSync(png));
}

/** 묶음 항목 → 행들(방향 또는 이름 붙은 행) */
export function fxRows(out: string, a: FxAsset): FxRow[] {
  const msOf = (n: number) => Array.from({ length: n }, (_, i) => a.ms?.[i] ?? a.ms?.[0] ?? 100);
  if (a.anim) return [{ name: 'any', ...strip(out, a.anim) }];
  if (a.rows) return Object.entries(a.rows).map(([name, anim]) => ({ name, ...strip(out, anim) }));
  const frames = a.frames ?? [];
  if (a.dirs === 8) return FX_DIRS.map((d) => ({ name: d, frames: frames.map((f) => sprite(out, d === 'e' ? f : `${f}_${d}`)), ms: msOf(frames.length) }));
  return [{ name: 'any', frames: frames.map((f) => sprite(out, f)), ms: msOf(frames.length) }];
}

/** 셀 가운데에 놓기(셀 = 모든 프레임 중 가장 큰 폭·높이, 짝수로) — 회전으로 커진 방향도 같은 셀, 중심 = 앵커 */
export function centerIn(img: RgbaImage, cw: number, ch: number): RgbaImage {
  const ox = Math.floor((cw - img.w) / 2), oy = Math.floor((ch - img.h) / 2), rgba = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < img.h; y++) rgba.set(img.rgba.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((oy + y) * cw + ox) * 4);
  return { w: cw, h: ch, rgba };
}

/** fx QA(기존 fx 규칙): 알파 0/255, 팔레트 일치, 프레임 수, 8방향 완비, 크기(빈 프레임) */
export function fxQa(rows: readonly FxRow[], a: FxAsset, palette: ReadonlySet<number>): { id: string; note: string }[] {
  const out: { id: string; note: string }[] = [];
  const all = rows.flatMap((r) => r.frames);
  if (all.some((f) => f.rgba.some((v, i) => i % 4 === 3 && v !== 0 && v !== 255))) out.push({ id: 'fx.alpha', note: '알파가 0/255가 아닌 칸' });
  const off = new Set<string>();
  for (const f of all) for (let i = 0; i < f.rgba.length; i += 4) {
    if (!f.rgba[i + 3]) continue;
    const c = ((f.rgba[i] ?? 0) << 16) | ((f.rgba[i + 1] ?? 0) << 8) | (f.rgba[i + 2] ?? 0);
    if (!palette.has(c)) off.add(`#${c.toString(16).padStart(6, '0')}`);
  }
  if (off.size) out.push({ id: 'fx.palette', note: `팔레트 밖 색 ${[...off].slice(0, 4).join(' ')}` });
  const counts = new Set(rows.map((r) => r.frames.length));
  if (counts.size > 1) out.push({ id: 'fx.frames', note: `행마다 프레임 수가 다름 ${[...counts].join('/')}` });
  if (a.dirs === 8 && (rows.length !== 8 || rows.some((r, i) => r.name !== FX_DIRS[i]))) out.push({ id: 'fx.directions', note: '8방향 행이 모자람' });
  const empty = rows.flatMap((r) => r.frames.flatMap((f, k) => (f.rgba.some((v, i) => i % 4 === 3 && v > 0) ? [] : [`${r.name}:${k}`])));
  if (empty.length && !a.frames?.[0]?.startsWith('fx_ring')) out.push({ id: 'fx.size', note: `빈 프레임 ${empty.join(',')}` });
  return out;
}
