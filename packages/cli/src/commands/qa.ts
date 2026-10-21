import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildBiblePalette, parseHex, toRGBA, type BiblePalette, type IndexedRaster } from '@pixel-forge/core';
import { contactSheet, runChecks, type Check, type QaContext, type QaFrame, type Report } from '@pixel-forge/qa';
import { mirrorFrame, renderAnimations, renderFrame, type AnimFrame, type RenderMeta, type RenderResult } from '@pixel-forge/render';
import { resolveMotion } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { validateProject } from './validate.js';

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

export interface Rendered {
  palette: BiblePalette;
  rest: RenderResult;
  frames: AnimFrame[];
}

/** rest + 지정 애니(없으면 Spec의 animations 전부). 공용 애니 파일이 없으면 rest만 */
export function renderProject(p: Project, ids: readonly string[] = p.spec.animations): Rendered {
  validateProject(p);
  const palette = buildBiblePalette(p.bible, p.rules);
  const ctx = { ...p, palette };
  if (!p.anims || !ids.length) return { palette, rest: renderFrame(ctx), frames: [] };
  const { rest, frames } = renderAnimations(ctx, p.anims, ids);
  return { palette, rest, frames };
}

const qaFrame = (name: string, raster: IndexedRaster, meta: RenderMeta, rootFixed: boolean, stillParts?: Set<number>): QaFrame =>
  ({ name, raster, ...meta.layers, face: meta.face, rootFixed, ...(stillParts ? { stillParts } : {}) });

/** 애니별 행. 같은 애니 안에서 앞 프레임과 변환이 같은 파츠를 stillParts로 넘긴다(anim.flicker) */
export function qaRows(r: Rendered): QaFrame[][] {
  const rows: QaFrame[][] = [[qaFrame('rest', r.rest.raster, r.rest.meta, true)]];
  for (const f of r.frames) {
    if (f.index === 0) rows.push([]);
    const prev = r.frames[r.frames.indexOf(f) - 1];
    const still = new Set<number>();
    if (f.index > 0 && prev) {
      f.meta.partTransforms.forEach((t, i) => {
        const q = prev.meta.partTransforms[i];
        if (q && q[0] === t[0] && q[1] === t[1] && q[2] === t[2]) still.add(i + 1);
      });
    }
    rows[rows.length - 1]?.push(qaFrame(`${f.anim}_r_${f.index}`, f.raster, f.meta, f.rootFixed, f.index > 0 ? still : undefined));
  }
  return rows;
}

export function writeFrames(dir: string, r: Rendered): string[] {
  const png = (rel: string, raster: IndexedRaster) => {
    writeFileEnsured(join(dir, rel), encodePng({ w: raster.w, h: raster.h, rgba: toRGBA(raster, r.palette.palette) }));
    return rel;
  };
  const files = [png('frames/rest.png', r.rest.raster)];
  for (const f of r.frames) {
    files.push(png(`frames/${f.anim}_r_${f.index}.png`, f.raster), png(`frames/${f.anim}_l_${f.index}.png`, mirrorFrame(f.raster)));
  }
  return files;
}

/** 렌더 → 검사 → out/<id>/{frames/*, qa.json, sheet.png, motion.json} */
export function runQa(p: Project, cwd: string, extra: readonly Check[] = []): Report {
  const r = renderProject(p);
  const rows = qaRows(r);
  const report: Report = { ...runChecks(rows.flat(), qaContext(p, r.palette), extra), budget: r.rest.meta.budget };
  const dir = join(cwd, 'out', p.spec.id);
  writeFrames(dir, r);
  writeFileSync(join(dir, 'motion.json'), JSON.stringify(resolveMotion(p.bible.motion, p.spec.motion), null, 2) + '\n');
  const sheet = contactSheet(rows, r.palette.palette, report.checks, { scale: p.rules.qa.sheetScale, background: p.bible.background });
  writeFileEnsured(join(dir, 'sheet.png'), encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  report.sheet.path = relative(cwd, join(dir, 'sheet.png'));
  writeFileSync(join(dir, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

export const summary = (r: Report) => ({ pass: r.pass, score: r.score, failed: r.checks.filter((c) => !c.pass).map((c) => c.id) });

export function qaCommand(specPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  const report = runQa(p, cwd);
  return { ok: true as const, cmd: 'qa', id: p.spec.id, ...summary(report), out: relative(cwd, join(cwd, 'out', p.spec.id, 'qa.json')) };
}
