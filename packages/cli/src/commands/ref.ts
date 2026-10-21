import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { z } from 'zod';
import { FORGE_VERSION, ForgeError, createIndexed, createPalette, addColor, packRgba, type IndexedRaster, type Palette } from '@pixel-forge/core';
import { analyzeRef, type RefMeasure } from '@pixel-forge/qa';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { decodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { renderProject } from './qa.js';

export interface RefArgs { source?: string; license?: string; id?: string }

const refSchema = z.object({
  id: z.string(), source: z.string(), license: z.string(), measuredWith: z.string(),
  measure: z.custom<RefMeasure>((v) => typeof v === 'object' && v !== null && 'silhouette' in v),
}).passthrough();

/** RGBA → 인덱스 래스터(처음 나온 순서로 팔레트). 알파 128 미만은 투명, 반투명 픽셀 수는 따로 센다 */
export function indexImage(img: { w: number; h: number; rgba: Uint8Array }): { raster: IndexedRaster; palette: Palette; semiTransparent: number } {
  const raster = createIndexed(img.w, img.h);
  let palette = createPalette();
  const seen = new Map<number, number>();
  let semi = 0;
  for (let k = 0; k < img.w * img.h; k++) {
    const a = img.rgba[k * 4 + 3] ?? 0;
    if (a > 0 && a < 255) semi++;
    if (a < 128) continue;
    const c = packRgba(img.rgba[k * 4] ?? 0, img.rgba[k * 4 + 1] ?? 0, img.rgba[k * 4 + 2] ?? 0, 255);
    let idx = seen.get(c);
    if (idx === undefined) { const r = addColor(palette, c, `ref:${seen.size}`); palette = r.palette; idx = r.index; seen.set(c, idx); }
    raster.px[k] = idx;
  }
  return { raster, palette, semiTransparent: semi };
}

/**
 * forge ref analyze <png> --source <url> --license <id> [--id <id>]: 측정값만 data/refs/<id>.ref.json에.
 * 원본 이미지는 저장소에 복사하지 않는다(저작권). 라이선스·출처 누락은 입력 오류(exit 1).
 */
export function refAnalyzeCommand(png: string, cwd: string, a: RefArgs) {
  if (!a.license) throw new ForgeError('ref.license', '라이선스가 필요합니다: --license <id> (예: CC0)');
  if (!a.source) throw new ForgeError('ref.source', '출처가 필요합니다: --source <url>');
  const path = resolveInside(cwd, png);
  if (!existsSync(path)) throw new ForgeError('io.not-found', `파일이 없습니다: ${png}`);
  const id = a.id ?? basename(path).replace(/\.png$/i, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) throw new ForgeError('cli.args', `ref id 형식 오류: ${id} (--id로 지정)`);
  const { raster, palette, semiTransparent } = indexImage(decodePng(readFileSync(path)));
  const measure = analyzeRef(raster, palette);
  const out = join(cwd, 'data', 'refs', `${id}.ref.json`);
  writeFileEnsured(out, Buffer.from(JSON.stringify({ id, source: a.source, license: a.license, measuredWith: FORGE_VERSION, semiTransparent, measure }, null, 2) + '\n'));
  return {
    ok: true as const, cmd: 'ref analyze', id, license: a.license, heightPx: measure.silhouette.heightPx, colors: measure.uniqueColors,
    ramps: measure.ramps.length, outline: measure.outline.type, out: relative(cwd, out),
  };
}

type Row = { metric: string; spec: number | string; ref: number | string; diff: number | null };

/** forge ref compare <spec> <ref>: Spec rest 프레임을 같은 측정기로 재서 레퍼런스와의 차이 표 → out/<id>/ref-<refid>.json */
export function refCompareCommand(specPath: string, refPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  const ref = readJson(resolveInside(cwd, refPath), refSchema);
  const r = renderProject(p, []);
  const m = analyzeRef(r.rest.raster, r.palette.palette);
  const R = ref.measure;
  const num = (metric: string, s: number, f: number): Row => ({ metric, spec: s, ref: f, diff: Math.round((s - f) * 1000) / 1000 });
  const avgShift = (x: RefMeasure) => { const c = x.ramps.filter((q) => q.colors.length > 1); return c.length ? Math.round(c.reduce((a, q) => a + Math.abs(q.hueShiftDeg), 0) / c.length) : 0; };
  const rows: Row[] = [
    num('silhouette.heightPx', m.silhouette.heightPx, R.silhouette.heightPx),
    num('silhouette.fill', round(m.silhouette.heightPx / m.canvas[1]), round(R.silhouette.heightPx / R.canvas[1])),
    num('uniqueColors', m.uniqueColors, R.uniqueColors),
    num('ramps', m.ramps.length, R.ramps.length),
    num('hueShiftDeg(평균 |이동|)', avgShift(m), avgShift(R)),
    num('headRatio', m.headRatio, R.headRatio),
    { metric: 'outline.type', spec: m.outline.type, ref: R.outline.type, diff: null },
  ];
  const out = join(cwd, 'out', p.spec.id, `ref-${ref.id}.json`);
  writeFileEnsured(out, Buffer.from(JSON.stringify({ spec: p.spec.id, ref: ref.id, license: ref.license, rows }, null, 2) + '\n'));
  return { ok: true as const, cmd: 'ref compare', id: p.spec.id, ref: ref.id, rows: rows.length, out: relative(cwd, out) };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
