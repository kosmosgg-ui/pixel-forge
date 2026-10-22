import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { buildBiblePalette, FORGE_VERSION, ForgeError, toRGBA, type IndexedRaster, type Palette } from '@pixel-forge/core';
import { buildManifest, packCharacter } from '@pixel-forge/export';
import { importChecks, importImage, probeImage, type ImportResult } from '@pixel-forge/import';
import { contactSheet } from '@pixel-forge/qa';
import { bibleSchema, resolveMotion, rulesSchema, specSchema, type Bible, type Rules, type Spec } from '@pixel-forge/spec';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { decodePng, encodePng } from '../io/png.js';
import { bibleFile } from '../io/project.js';
import { exportImportTarget } from './import-target.js';
import { packFiles } from './pack-files.js';

const DEFAULT_FPS = 8;

export interface Imported {
  spec: Spec;
  bible: Bible;
  rules: Rules;
  result: ImportResult;
  palette: Palette;
  /** 입력 PNG sha256(결정론 — 같은 입력 + 같은 Spec → 같은 출력) */
  sourceHash: string;
  cell: { w: number; h: number; anchor: [number, number] };
}

/** 셀·앵커·키: Spec cell → 바이블 크기 등급(size·anchor·height). feet-center = 가로 가운데, 바닥에서 2px 위 */
function cellOf(spec: Spec, bible: Bible): Imported['cell'] {
  const size = bible.sizeClasses[spec.sizeClass];
  const opt = bible.sizeClassOptions[spec.sizeClass];
  const w = spec.cell?.w ?? size?.[0], h = spec.cell?.h ?? size?.[1];
  if (w === undefined || h === undefined) throw new ForgeError('import.cell', `셀 크기가 없습니다: Spec cell 또는 바이블 sizeClasses.${spec.sizeClass}`);
  const a = spec.cell?.anchor;
  const anchor: [number, number] = Array.isArray(a) ? [a[0], a[1]] : a === undefined && opt?.anchor ? [opt.anchor[0], opt.anchor[1]] : [Math.floor(w / 2), h - 2];
  return { w, h, anchor };
}

/** Spec 읽기 → 입력 PNG(작업 폴더 안만) → importImage. 생성 API는 부르지 않는다(입력 파일만) */
export function runImport(specPath: string, cwd: string): Imported {
  const spec = readJson(resolveInside(cwd, specPath), specSchema);
  if (spec.mode !== 'import' || !spec.source || !spec.layout) throw new ForgeError('import.mode', `import 모드 Spec이 아닙니다: ${specPath}`);
  const bible = readJson(bibleFile(spec.bible, cwd), bibleSchema);
  const rules = readJson(join(cwd, 'data', 'rules', 'default.rules.json'), rulesSchema);
  const bytes = readFileSync(resolveInside(cwd, spec.source.path));
  const cell = cellOf(spec, bible);
  const fixed = spec.palette.from === 'bible' ? [...buildBiblePalette(bible, rules).palette.colors.slice(1)].map((c) => c >>> 8) : undefined;
  const targetHeight = spec.targetHeight ?? bible.sizeClassOptions[spec.sizeClass]?.height;
  const result = importImage(decodePng(bytes), {
    rows: spec.layout.rows, cell, alphaThreshold: spec.alphaThreshold, dedupe: spec.dedupe, background: spec.background,
    palette: { max: spec.palette.max, ...(fixed ? { fixed } : {}) },
    ...(targetHeight !== undefined ? { targetHeight } : {}),
    ...(spec.outline === 'bible' && bible.outline.mode !== 'none' ? { outline: parseInt(bible.outline.globalColor.slice(1, 7), 16) } : {}),
  });
  const palette: Palette = { colors: Uint32Array.from([0, ...result.palette.map((c) => ((c << 8) | 255) >>> 0)]), names: ['transparent', ...result.palette.map((_, i) => `import-${i + 1}`)] };
  return { spec, bible, rules, result, palette, sourceHash: createHash('sha256').update(bytes).digest('hex'), cell };
}

const frameName = (f: { anim: string; dir: string; index: number }) => `${f.anim}_${f.dir}_${f.index}`;

/** forge import <spec> → out/<id>/{frames/*, sheet.png, qa.json, <id>.png, <id>.json(Aseprite), manifest.json} */
export function importCommand(specPath: string, cwd: string, o: { target?: string; out?: string } = {}) {
  const im = runImport(specPath, cwd);
  const { spec, result: r } = im;
  const dir = join(cwd, 'out', spec.id);
  rmSync(dir, { recursive: true, force: true });
  const png = (rel: string, ras: IndexedRaster) => writeFileEnsured(join(dir, rel), encodePng({ w: ras.w, h: ras.h, rgba: toRGBA(ras, im.palette) }));
  for (const f of r.frames) png(`frames/${frameName(f)}.png`, f.frame);
  const checks = importChecks(r);
  const groups = new Map<string, typeof r.frames>();
  for (const f of r.frames) groups.set(`${f.anim}_${f.dir}`, [...(groups.get(`${f.anim}_${f.dir}`) ?? []), f]);
  const rows = [...groups.values()].map((g) => g.map((f) => ({ name: frameName(f), raster: f.frame })));
  const sheet = contactSheet(rows, im.palette, [], { scale: im.rules.qa.sheetScale, background: im.bible.background });
  writeFileEnsured(join(dir, 'sheet.png'), encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  const warnings = checks.filter((c) => !c.pass).map((c) => c.id);
  // import 검사는 경고만(사람이 원본을 다시 생성할지 정한다) — 처리 실패는 ForgeError로 이미 멈췄다
  const qa = { id: spec.id, mode: 'import', pass: true, warnings, checks, scale: Math.round(r.scale * 10000) / 10000, paletteSize: r.palette.length, sheet: { path: relative(cwd, join(dir, 'sheet.png')) } };
  writeFileSync(join(dir, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
  const files = writeImportPack(im, dir);
  // --target: 게임 형식으로 후보 폴더에(기본 타깃 = 바이블 apply.target)
  const target = o.target ?? (o.out ? im.bible.apply?.target : undefined);
  const exported = target ? { exported: exportImportTarget(im, cwd, target, o.out) } : {};
  return { ok: true as const, cmd: 'import', id: spec.id, frames: r.frames.length, palette: r.palette.length, warnings, out: relative(cwd, dir), files: files.map((f) => relative(cwd, f)), ...exported };
}

/** 표준 pack(Aseprite JSON + manifest) + import 기록(입력 sha256, aiGenerated, frameMap) */
function writeImportPack(im: Imported, dir: string): string[] {
  const { spec, result: r } = im;
  const first = r.frames[0];
  if (!first) throw new ForgeError('import.empty', '가져온 프레임이 없습니다');
  const fps = new Map((spec.layout?.rows ?? []).map((row) => [`${row.anim}_${row.dir}`, row.fps ?? DEFAULT_FPS]));
  const anims = [...new Set(r.frames.map((f) => f.anim))];
  const packed = packCharacter({
    id: spec.id, bible: im.bible.id, sizeClass: spec.sizeClass, rest: first.frame, rootX: im.cell.anchor[0],
    frames: r.frames.map((f) => ({ anim: f.anim, index: f.index, raster: f.frame, dir: f.dir, ms: Math.round(1000 / (fps.get(`${f.anim}_${f.dir}`) ?? DEFAULT_FPS)) })),
    loops: Object.fromEntries(anims.map((a) => [a, spec.loop.includes(a)])),
    motion: resolveMotion(im.bible.motion, spec.motion), palette: im.palette, version: FORGE_VERSION,
  }, `${spec.id}.png`);
  const sheetPng = encodePng({ w: packed.sheet.w, h: packed.sheet.h, rgba: toRGBA(packed.sheet, im.palette) });
  const [img = '', data = '', manifest = ''] = packFiles(spec.id);
  writeFileEnsured(join(dir, img), sheetPng);
  writeFileSync(join(dir, data), JSON.stringify(packed.json, null, 1) + '\n');
  const hash = createHash('sha256').update(sheetPng).digest('hex');
  const src = spec.source;
  const record = {
    ...buildManifest({ ...packed.manifest, hash }),
    // rule: import.provenance — 스팀 AI 공개 기록(사용자 승인 P8): 생성 출처·입력 해시
    source: { path: src?.path ?? '', sha256: im.sourceHash, origin: src?.origin ?? '', ...(src?.createdAt ? { createdAt: src.createdAt } : {}) },
    aiGenerated: true, frameMap: r.frameMap, anchor: im.cell.anchor,
  };
  writeFileSync(join(dir, manifest), JSON.stringify(record, null, 2) + '\n');
  return [img, data, manifest].map((f) => join(dir, f));
}

/** forge import --probe <png>: Spec 없이 분석만(Spec 작성 보조) → out/probe/<이름>.md 표 + 한 줄 요약 */
export function probeCommand(pngPath: string, cwd: string, alphaThreshold = 128) {
  const p = probeImage(decodePng(readFileSync(resolveInside(cwd, pngPath))), alphaThreshold);
  const name = basename(pngPath).replace(/\.png$/i, '');
  const out = join(cwd, 'out', 'probe', `${name}.md`);
  const range = ([lo, mid, hi]: readonly number[]) => `${lo}~${hi} (중앙 ${mid})`;
  const table = [
    `# probe: ${pngPath}`, '', '| 항목 | 값 |', '| --- | --- |',
    `| 스프라이트 | ${p.sprites} |`, `| 줄 | ${p.rows} (${p.perRow.join(' · ')}) |`,
    `| 키(px) | ${range(p.height)} |`, `| 폭(px) | ${range(p.width)} |`,
    `| 잘림 | ${p.clipped.length}${p.clipped.length ? ` (${p.clipped.map((i) => `#${i} ${(p.clippedEdges[i] ?? []).join('·')}`).join(', ')})` : ''} |`,
    `| 고유 프레임 | ${p.unique} |`, `| 색 수 | ${p.colors} |`, `| 반투명 픽셀 | ${p.semiAlpha} |`,
  ];
  writeFileEnsured(out, Buffer.from(table.join('\n') + '\n'));
  return { ok: true as const, cmd: 'import-probe', sprites: p.sprites, rows: p.rows, perRow: p.perRow, clipped: p.clipped.length, clippedAt: p.clippedEdges, unique: p.unique, colors: p.colors, out: relative(cwd, out) };
}
