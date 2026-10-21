import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildBiblePalette, parseHex, toRGBA, type BiblePalette } from '@pixel-forge/core';
import { contactSheet, runChecks, type Check, type QaContext, type QaFrame, type Report } from '@pixel-forge/qa';
import { renderFrame } from '@pixel-forge/render';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { validateProject } from './validate.js';

export const OUT_FILES = ['frames/rest.png', 'qa.json', 'sheet.png'] as const;

export function qaContext(p: Project, palette: BiblePalette): QaContext {
  const rampOf = new Map<number, { ramp: string; step: number }>();
  for (const r of Object.values(palette.ramps)) r.indices.forEach((idx, step) => { if (!rampOf.has(idx)) rampOf.set(idx, { ramp: r.id, step }); });
  const roleMat = p.spec.role === undefined ? undefined : p.bible.roleColorKey[p.spec.role];
  const roleRamp = roleMat === undefined ? undefined : palette.ramps[roleMat];
  return {
    id: p.spec.id, palette: palette.palette, budget: p.bible.colorBudget[p.spec.sizeClass] ?? Infinity,
    background: parseHex(p.bible.background), rules: p.rules.qa, rampOf,
    ...(roleRamp ? { roleIndices: new Set([...roleRamp.indices, roleRamp.outline]) } : {}),
  };
}

export interface QaRun {
  report: Report;
  frames: QaFrame[];
  palette: BiblePalette;
}

/** rest 프레임 렌더 → 검사 → out/<id>/{frames/rest.png, qa.json, sheet.png} */
export function runQa(p: Project, cwd: string, extra: readonly Check[] = []): QaRun {
  validateProject(p);
  const palette = buildBiblePalette(p.bible, p.rules);
  const { raster, meta } = renderFrame({ ...p, palette });
  const frames: QaFrame[] = [{ name: 'rest', raster, ...meta.layers, face: meta.face, rootFixed: true }];
  const report = { ...runChecks(frames, qaContext(p, palette), extra), budget: meta.budget };
  writeOutputs(p, cwd, frames, palette, report);
  return { report, frames, palette };
}

export function writeOutputs(p: Project, cwd: string, frames: readonly QaFrame[], palette: BiblePalette, report: Report): void {
  const dir = join(cwd, 'out', p.spec.id);
  const rest = frames[0]?.raster;
  if (rest) writeFileEnsured(join(dir, 'frames', 'rest.png'), encodePng({ w: rest.w, h: rest.h, rgba: toRGBA(rest, palette.palette) }));
  const sheet = contactSheet([frames], palette.palette, report.checks, { scale: p.rules.qa.sheetScale, background: p.bible.background });
  writeFileEnsured(join(dir, 'sheet.png'), encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  report.sheet.path = relative(cwd, join(dir, 'sheet.png'));
  writeFileSync(join(dir, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
}

export const summary = (r: Report) => ({ pass: r.pass, score: r.score, failed: r.checks.filter((c) => !c.pass).map((c) => c.id) });

export function qaCommand(specPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  const { report } = runQa(p, cwd);
  return { ok: true as const, cmd: 'qa', id: p.spec.id, ...summary(report), out: relative(cwd, join(cwd, 'out', p.spec.id, 'qa.json')) };
}
