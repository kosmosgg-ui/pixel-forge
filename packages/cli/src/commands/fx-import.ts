import { join, relative } from 'node:path';
import { parseHex, ForgeError } from '@pixel-forge/core';
import { bibleSchema, fxAssetsSchema, type FxAsset } from '@pixel-forge/spec';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { encodePng, type RgbaImage } from '../io/png.js';
import { bibleFile } from '../io/project.js';
import { PXL_COMMIT, pxlBin, pxlBuild, pxlCommit } from '../io/pxl.js';
import { centerIn, fxQa, fxRows, type FxRow } from './fx-frames.js';
import { displayScaleOf, loadTarget, writeRowExport } from './import-target.js';

import { fxSource } from './fx-source.js';

const DEFAULT_ASSETS = 'data/projects/seonggeom/fx/fx_assets.json';
const PREVIEW_BG = '#1f1a24';

/** pxl 소스의 pal({...}) 색(팔레트 일치 검사 기준) */
export function palOf(src: string): Set<number> {
  const block = /pal\(\{([\s\S]*?)\}\)/.exec(src)?.[1] ?? '';
  return new Set([...block.matchAll(/"#([0-9a-fA-F]{6})"/g)].map((m) => parseInt(m[1] ?? '0', 16)));
}

const even = (n: number) => n + (n % 2);

function blit(dst: Uint8Array, dw: number, img: RgbaImage, ox: number, oy: number, k = 1): void {
  for (let y = 0; y < img.h * k; y++) for (let x = 0; x < img.w * k; x++) {
    const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
    if (img.rgba[s + 3]) dst.set(img.rgba.subarray(s, s + 4), ((oy + y) * dw + ox + x) * 4);
  }
}

/** 행(방향·이름) × 열(프레임) 시트 + 게임 매니페스트(kind fx) */
function packAsset(id: string, a: FxAsset, rows: FxRow[], ctx: { cwd: string; source: string; commit: string; palette: Set<number>; outArg?: string }) {
  const all = rows.flatMap((r) => r.frames);
  const cw = even(Math.max(...all.map((f) => f.w))), ch = even(Math.max(...all.map((f) => f.h)));
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const W = cw * cols, H = ch * rows.length, rgba = new Uint8Array(W * H * 4);
  rows.forEach((r, y) => r.frames.forEach((f, x) => blit(rgba, W, centerIn(f, cw, ch), x * cw, y * ch)));
  const warnings = fxQa(rows, a, ctx.palette);
  if (ctx.commit !== PXL_COMMIT) warnings.push({ id: 'fx.pxl-commit', note: `pxl ${ctx.commit} ≠ 고정 ${PXL_COMMIT}` });
  const bible = readJson(bibleFile('seonggeom', ctx.cwd), bibleSchema);
  const t = loadTarget(bible.id, ctx.cwd);
  const ms = rows[0]?.ms ?? [];
  const manifest = {
    assetId: id, kind: 'fx', version: t.version, quality: 'candidate', source: `pixel-forge/pxl ${ctx.commit}: ${ctx.source}`,
    frame_size: [cw, ch], sheet_size: [W, H], anchor: [cw / 2, ch / 2], display_scale: displayScaleOf(bible), columns: cols,
    rows: Object.fromEntries(rows.map((r, i) => [r.name, i])), mirror: {},
    animations: { play: { start_column: 0, frames: cols, fps: Math.round(1000 / (ms[0] ?? 100)), loop: a.loop, ms } },
    notes: ['코드로 그린 이펙트(pxl) — 생성형 AI 산출물 아님', '방향 이펙트는 8방향 미리 생성 — 실시간 회전 금지, 앵커 = 셀 가운데', ...(a.note ? [a.note] : [])],
    provenance: { assetId: id, creator: 'pixel-forge/pxl (code-drawn)', sourceUrl: '', license: '프로젝트 소유(코드 그림)', aiUsed: false, promptRecord: null, editedBy: 'Claude Code', sourceFile: ctx.source, exportFile: `${id}_sheet.png`, rightsReviewed: false, creditText: '', pxlCommit: ctx.commit },
    qa: { pass: warnings.length === 0, warnings },
  };
  return { id, rows, warnings, ...writeRowExport(ctx.cwd, t, id, encodePng({ w: W, h: H, rgba }), manifest, join(ctx.cwd, 'out', 'fx', id), ctx.outArg) };
}

/** 한눈 시트: 이펙트마다 첫 행 전 프레임 ×3 + 아래 게임 2배 미리보기(모든 행의 가운데 프레임) */
function overview(packed: { rows: FxRow[] }[]): { w: number; h: number; rgba: Uint8Array } {
  const pad = 6, k = 3, p = 2, W = 1600;
  const top = packed.map((x) => x.rows[0]?.frames ?? []);
  const items = packed.flatMap((x) => x.rows.map((r) => r.frames[Math.floor(r.frames.length / 2)])).filter((f): f is RgbaImage => f !== undefined);
  let pw = pad, ph = 0, lines = 1;
  for (const f of items) { if (pw + f.w * p > W) { lines++; pw = pad; } pw += f.w * p + pad; ph = Math.max(ph, f.h * p); }
  const H = top.reduce((a, fs) => a + Math.max(...fs.map((f) => f.h)) * k + pad, pad) + (ph + pad) * lines + pad, rgba = new Uint8Array(W * H * 4);
  const [r, g, b] = parseHex(PREVIEW_BG);
  for (let i = 0; i < W * H; i++) rgba.set([r, g, b, 255], i * 4);
  let y = pad;
  for (const fs of top) { let x = pad; for (const f of fs) { if (x + f.w * k < W) blit(rgba, W, f, x, y, k); x += f.w * k + pad; } y += Math.max(...fs.map((f) => f.h)) * k + pad; }
  let x = pad;
  for (const f of items) { if (x + f.w * p > W) { x = pad; y += ph + pad; } blit(rgba, W, f, x, y, p); x += f.w * p + pad; }
  return { w: W, h: H, rgba };
}

/**
 * forge fx-import [묶음.json] [--out @이름]: pxl(외부, 2e72b9a 고정)로 sg_fx.px.js를 빌드 → 이펙트마다 godot-rowsheet 후보(kind fx) + 한눈 시트 out/fx/fx_sheet.png.
 */
export function fxImportCommand(cwd: string, o: { assets?: string; out?: string } = {}) {
  const spec = readJson(resolveInside(cwd, o.assets ?? DEFAULT_ASSETS), fxAssetsSchema);
  const bin = pxlBin(process.env, process.version);
  const src = resolveInside(cwd, spec.source), pxlOut = join(cwd, 'out', 'pxl');
  const commit = pxlCommit(bin);
  if (commit !== PXL_COMMIT) throw new ForgeError('fx.pxl-commit', `pxl 고정 ${PXL_COMMIT} 필요(현재 ${commit})`);
  const bible = readJson(bibleFile('seonggeom', cwd), bibleSchema);
  const prepared = fxSource(src, bible, cwd);
  pxlBuild(bin, prepared.file, pxlOut);
  const ctx = { cwd, source: spec.source, commit, palette: prepared.colors ? new Set(prepared.colors.map((c) => parseInt(c.slice(1), 16))) : palOf(prepared.text), ...(o.out ? { outArg: o.out } : {}) };
  const packed = Object.entries(spec.assets).map(([id, a]) => packAsset(id, a, fxRows(pxlOut, a), ctx));
  const sheet = join(cwd, 'out', 'fx', 'fx_sheet.png');
  writeFileEnsured(sheet, encodePng(overview(packed)));
  return { ok: true as const, cmd: 'fx-import', pxl: ctx.commit, count: packed.length, warnings: packed.flatMap((p) => p.warnings.map((w) => `${p.id}:${w.id}`)), sheet: relative(cwd, sheet), dest: packed[0]?.dest };
}
