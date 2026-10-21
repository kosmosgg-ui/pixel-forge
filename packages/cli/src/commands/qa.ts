import { rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildBiblePalette, parseHex, toRGBA, type BiblePalette, type IndexedRaster } from '@pixel-forge/core';
import { contactSheet, runChecks, type Check, type HeldInfo, type QaContext, type QaFrame, type Report } from '@pixel-forge/qa';
import { mirrorFrame, renderAnimations, renderFitted, renderFrame, type AnimFrame, type RenderMeta, type RenderResult, type SizeFit } from '@pixel-forge/render';
import { resolveMotion } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { packFiles } from './pack-files.js';
import { validateProject } from './validate.js';

/** held 파츠별 손 파츠(부착 뼈의 부모 뼈 파츠), 같은 뼈 파츠(날밑·손잡이), rest 픽셀 수 */
export function heldInfo(p: Project, restPart?: Uint16Array): HeldInfo[] {
  const ids = (f: (bone: string) => boolean) => p.spec.parts.flatMap((q, j) => (f(q.bone) ? [j + 1] : []));
  return p.spec.parts.flatMap((part, i) => {
    if (!part.held) return [];
    const parent = p.rig.bones[part.bone]?.parent;
    const hand = ids((b) => b === parent);
    const group = ids((b) => b === part.bone).filter((j) => j !== i + 1);
    const restCount = restPart ? restPart.reduce((a, v) => a + (v === i + 1 ? 1 : 0), 0) : 0;
    return [{ part: i + 1, name: part.name ?? part.bone, hand, group, restCount }];
  });
}

export function qaContext(p: Project, palette: BiblePalette, rest?: RenderResult): QaContext {
  const rampOf = new Map<number, { ramp: string; step: number }>();
  for (const r of Object.values(palette.ramps)) r.indices.forEach((idx, step) => { if (!rampOf.has(idx)) rampOf.set(idx, { ramp: r.id, step }); });
  const roleMat = p.spec.role === undefined ? undefined : p.bible.roleColorKey[p.spec.role];
  const roleRamp = roleMat === undefined ? undefined : palette.ramps[roleMat];
  return {
    id: p.spec.id, palette: palette.palette, budget: p.bible.colorBudget[p.spec.sizeClass] ?? Infinity,
    background: parseHex(p.bible.background), rules: p.rules.qa, rampOf,
    ...(roleRamp ? { roleIndices: new Set([...roleRamp.indices, roleRamp.outline]) } : {}),
    held: heldInfo(p, rest?.meta.layers.part),
    ...(p.spec.signature ? { signature: { name: p.spec.signature, parts: new Set(p.spec.parts.flatMap((q, i) => (q.signature ? [i + 1] : []))) } } : {}),
    lineIndices: new Set([...Object.values(palette.ramps).map((r) => r.outline), palette.outlineIndex]),
  };
}

export interface Rendered {
  palette: BiblePalette;
  rest: RenderResult;
  frames: AnimFrame[];
  /** 실제로 렌더한 프로젝트(크기 등급을 맞춘 Spec) — QA·pack은 이것을 쓴다 */
  project: Project;
  sizeClass: SizeFit;
}

/**
 * rest + 지정 애니(없으면 Spec의 animations 전부). 공용 애니 파일이 없으면 rest만.
 * 크기 등급은 Spec 애니 전부를 렌더해 정한다(일부 애니만 요청해도 같은 등급이 나오게) — 넘치면 큰 등급으로 다시 렌더.
 */
export function renderProject(p: Project, ids: readonly string[] = p.spec.animations): Rendered {
  validateProject(p);
  const palette = buildBiblePalette(p.bible, p.rules);
  const anims = p.anims;
  const all = anims ? p.spec.animations : [];
  const { result, fit } = renderFitted(
    { ...p, palette },
    (c) => (anims && all.length ? renderAnimations(c, anims, all) : { rest: renderFrame(c), frames: [] as AnimFrame[] }),
    (t) => [{ raster: t.rest.raster, clipped: t.rest.clipped }, ...t.frames.map((f) => ({ raster: f.raster, clipped: f.clipped }))],
  );
  const project: Project = { ...p, spec: { ...p.spec, sizeClass: fit.used } };
  const want = new Set(ids);
  return { palette, rest: result.rest, frames: result.frames.filter((f) => want.has(f.anim)), project, sizeClass: fit };
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
  return runQaRendered(p, cwd, extra).report;
}

/** runQa + 렌더 결과(build가 같은 렌더로 pack하게) */
export function runQaRendered(p: Project, cwd: string, extra: readonly Check[] = []): { report: Report; rendered: Rendered } {
  const r = renderProject(p);
  const rows = qaRows(r);
  const report: Report = { ...runChecks(rows.flat(), qaContext(r.project, r.palette, r.rest), extra), budget: r.rest.meta.budget, sizeClass: r.sizeClass };
  const dir = join(cwd, 'out', p.spec.id);
  writeFrames(dir, r);
  writeFileSync(join(dir, 'motion.json'), JSON.stringify(resolveMotion(p.bible.motion, p.spec.motion), null, 2) + '\n');
  const sheet = contactSheet(rows, r.palette.palette, report.checks, { scale: p.rules.qa.sheetScale, background: p.bible.background });
  writeFileEnsured(join(dir, 'sheet.png'), encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  report.sheet.path = relative(cwd, join(dir, 'sheet.png'));
  writeFileSync(join(dir, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
  // 불합격이면 지난 합격 때의 pack이 남아 게임에 들어가지 않게 지운다
  if (!report.pass) for (const f of packFiles(p.spec.id)) rmSync(join(dir, f), { force: true });
  return { report, rendered: r };
}

export const summary = (r: Report) => ({ pass: r.pass, score: r.score, failed: r.checks.filter((c) => !c.pass).map((c) => c.id) });

export function qaCommand(specPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  const report = runQa(p, cwd);
  return { ok: true as const, cmd: 'qa', id: p.spec.id, ...summary(report), out: relative(cwd, join(cwd, 'out', p.spec.id, 'qa.json')) };
}
