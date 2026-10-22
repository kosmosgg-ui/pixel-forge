import { join, relative } from 'node:path';
import { ForgeError, toRGBA } from '@pixel-forge/core';
import { godotRowManifest, rowSheet, type RowAnim } from '@pixel-forge/export';
import { importChecks } from '@pixel-forge/import';
import { projectTargetSchema, type ProjectTarget } from '@pixel-forge/spec';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { encodePng } from '../io/png.js';
import { resolveOut } from '../io/targets.js';
import type { Imported } from './import.js';

const DEFAULT_FPS = 8;
export const IMPORT_TARGETS = ['godot-rowsheet'] as const;

/** 프로젝트 타깃 설정: data/projects/<바이블 id>/target.json */
export function loadTarget(bibleId: string, cwd: string): ProjectTarget {
  return readJson(resolveInside(join(cwd, 'data', 'projects'), join(bibleId, 'target.json')), projectTargetSchema);
}

/** 가져온 프레임 → 줄(방향)×애니 묶음. 열 수는 frameMap(중복 제거 전 순서)으로 되살린다 */
function rowAnims(im: Imported): RowAnim[] {
  return Object.entries(im.result.frameMap).map(([key, order]) => {
    const fs = im.result.frames.filter((f) => `${f.anim}_${f.dir}` === key).sort((a, b) => a.index - b.index);
    const first = fs[0];
    if (!first) throw new ForgeError('import.empty', `프레임이 없습니다: ${key}`);
    return { anim: first.anim, dir: first.dir, unique: fs.map((f) => f.frame), order };
  });
}

/** 후보 폴더 출력: out/<로컬>/{<id>_sheet.png, <id>_manifest.json} + 출력 폴더의 <target.dir>/<id>/(후보 폴더만) */
export function writeRowExport(cwd: string, t: ProjectTarget, assetId: string, png: Buffer, manifest: unknown, local: string, outArg?: string) {
  const sheetName = `${assetId}_sheet.png`, manifestName = `${assetId}_manifest.json`;
  const json = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const out = outArg ?? t.out;
  const dest = resolveInside(resolveOut(cwd, out), join(t.dir, assetId));
  for (const d of [local, dest]) { writeFileEnsured(join(d, sheetName), png); writeFileEnsured(join(d, manifestName), json); }
  return { local: relative(cwd, local), dest: out.startsWith('@') ? `${out}/${join(t.dir, assetId)}` : relative(cwd, dest) };
}

/** 게임 표시 배율: 바이블 display.spriteScale(없으면 1) */
export const displayScaleOf = (bible: Imported['bible']): number => bible.display?.spriteScale ?? 1;

/**
 * godot-rowsheet: out/<id>/<target>/{<id>_sheet.png, <id>_manifest.json} → 출력 폴더의 <target.dir>/<id>/(후보 폴더만).
 * 출력은 `@<이름>`(.forge/targets.local.json, 사람이 쓰는 허용 목록) 또는 작업 폴더 안 경로.
 */
export function exportImportTarget(im: Imported, cwd: string, target: string, outArg?: string) {
  if (!(IMPORT_TARGETS as readonly string[]).includes(target)) throw new ForgeError('cli.format', `지원하지 않는 import 타깃: ${target} (지원: ${IMPORT_TARGETS.join(', ')})`);
  const t = loadTarget(im.bible.id, cwd);
  const { spec, result: r } = im;
  const fps = new Map<string, number>();
  for (const row of spec.layout?.rows ?? []) if (!fps.has(row.anim)) fps.set(row.anim, row.fps ?? DEFAULT_FPS);
  const anims = [...fps].map(([name, f]) => ({ name, fps: f, loop: spec.loop.includes(name) }));
  const sheet = rowSheet({ cell: im.cell, rows: t.rows, anims, frames: rowAnims(im) });
  const src = spec.source;
  const manifest = godotRowManifest({
    assetId: spec.id, version: t.version, source: `pixel-forge import: ${src?.origin ?? ''} ${src?.path ?? ''} (sha256 ${im.sourceHash})`,
    sheet: { ...sheet, w: sheet.sheet.w, h: sheet.sheet.h }, cell: im.cell, directions: t.directions, anchor: im.cell.anchor, displayScale: displayScaleOf(im.bible), notes: t.notes,
    provenance: {
      assetId: spec.id, creator: t.provenance.creator, sourceUrl: t.provenance.sourceUrl, license: t.provenance.license,
      // import 입력은 AI 생성물. 권리 검토는 사람만 true로 바꾼다(사용자 승인 P8)
      aiUsed: true, promptRecord: src?.prompt ?? '', editedBy: t.provenance.editedBy,
      sourceFile: src?.path ?? '', exportFile: `${spec.id}_sheet.png`, rightsReviewed: false, creditText: t.provenance.creditText,
    },
    qa: { pass: true, warnings: importChecks(r).filter((c) => !c.pass).map((c) => ({ id: c.id, ...(c.note ? { note: c.note } : {}) })) },
  });
  const png = encodePng({ w: sheet.sheet.w, h: sheet.sheet.h, rgba: toRGBA(sheet.sheet, im.palette) });
  const w = writeRowExport(cwd, t, spec.id, png, manifest, join(cwd, 'out', spec.id, target), outArg);
  return { target, columns: sheet.columns, rows: sheet.rows, sheetSize: [sheet.sheet.w, sheet.sheet.h], ...w };
}
