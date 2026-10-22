import { rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildBiblePalette, ForgeError, parseHex, toRGBA, type BiblePalette, type IndexedRaster } from '@pixel-forge/core';
import { contactSheet, runChecks, type Check, type HeldInfo, type QaContext, type QaFrame, type Report } from '@pixel-forge/qa';
import { GRID_SIGNATURE_PART, mirrorFrame, renderAnimations, renderFitted, renderFrame, prerenderEyeCount, renderGridAnimations, renderPrerender, type AnimFrame, type RenderMeta, type RenderResult, type SizeFit } from '@pixel-forge/render';
import { DIRECTIONS } from '@pixel-forge/render3d';
import { resolveMotion, sampleFramesOf } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import type { PrerenderInput } from '../io/prerender.js';
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
    mode: p.spec.mode,
    ...(p.spec.signature ? { signature: { name: p.spec.signature, parts: p.spec.mode === 'frames' ? new Set([GRID_SIGNATURE_PART]) : new Set(p.spec.parts.flatMap((q, i) => (q.signature ? [i + 1] : []))) } } : {}),
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
export function renderProject(p: Project, ids: readonly string[] = defaultAnims(p)): Rendered {
  validateProject(p);
  const palette = buildBiblePalette(p.bible, p.rules);
  if (p.spec.mode === 'prerender') {
    // 캔버스는 Blender 카메라가 전 프레임 범위로 맞추므로 크기 등급 맞춤을 하지 않는다
    if (!p.prerender) throw new ForgeError('render3d.no-model', '프리렌더 입력이 없습니다');
    const input = p.prerender();
    const ctx = { ...p, palette };
    const res = renderPrerender(ctx, input.render(p.spec.directions === 4 ? pickDirections(ctx, input) : input.yaws), input.options);
    const want = new Set(ids);
    return { palette, rest: res.rest, frames: res.frames.filter((f) => want.has(f.anim)), project: p, sizeClass: { requested: p.spec.sizeClass, used: p.spec.sizeClass, reason: 'fits' } };
  }
  const anims = p.anims;
  // 프레임 모드는 Spec frames의 애니(공용 애니 파일·리그 포즈를 쓰지 않는다)
  const frames = p.spec.mode === 'frames';
  const all = frames ? Object.keys(p.spec.frames ?? {}) : anims ? p.spec.animations : [];
  const { result, fit } = renderFitted(
    { ...p, palette },
    (c) => (frames ? renderGridAnimations(c, all) : anims && all.length ? renderAnimations(c, anims, all) : { rest: renderFrame(c), frames: [] as AnimFrame[] }),
    (t) => [{ raster: t.rest.raster, clipped: t.rest.clipped }, ...t.frames.map((f) => ({ raster: f.raster, clipped: f.clipped }))],
  );
  const project: Project = { ...p, spec: { ...p.spec, sizeClass: fit.used } };
  const want = new Set(ids);
  return { palette, rest: result.rest, frames: result.frames.filter((f) => want.has(f.anim)), project, sizeClass: fit };
}

const qaFrame = (name: string, raster: IndexedRaster, meta: RenderMeta, rootFixed: boolean, stillParts?: Set<number>, anim = 'rest', key = true, dir?: string): QaFrame =>
  ({ name, raster, ...meta.layers, face: meta.face, rootFixed, ...(stillParts ? { stillParts } : {}), anim, key, eyes: meta.eyes.length, ...(dir ? { dir } : {}) });

/**
 * 4방향 기본값: 8방향 rest(첫 애니 첫 프레임)를 렌더해 눈 픽셀이 보이는 방향만, 눈이 많이 보이는 순으로 4개(사용자 승인 P7-alt).
 * 정면이 아닌 방향(뒤통수)을 기본 방향에 넣지 않으려는 것 — 결과 순서는 회전각 순.
 */
function pickDirections(ctx: Parameters<typeof renderPrerender>[0], input: PrerenderInput): Record<string, number> {
  const eight = { ...DIRECTIONS[8] };
  const first = Object.keys(ctx.spec.actions ?? {})[0] ?? '';
  const probe = input.render(eight, { [first]: [sampleFramesOf(ctx.spec)[first]?.[0] ?? 0] });
  const seen = probe.frames.map((f) => ({ dir: f.dir, eyes: prerenderEyeCount(ctx, probe, f, input.options) })).filter((d) => d.eyes > 0);
  const top = seen.sort((a, b) => b.eyes - a.eyes || (eight[a.dir] ?? 0) - (eight[b.dir] ?? 0)).slice(0, 4).map((d) => d.dir);
  if (!top.length) return input.yaws;
  return Object.fromEntries(Object.entries(eight).filter(([d]) => top.includes(d)));
}

/** Spec의 애니 목록: frames 모드 = frames 키, 프리렌더 = actions 키, 나머지 = animations */
export function defaultAnims(p: Project): string[] {
  if (p.spec.mode === 'frames') return Object.keys(p.spec.frames ?? {});
  if (p.spec.mode === 'prerender') return Object.keys(p.spec.actions ?? {});
  return p.spec.animations;
}

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
    rows[rows.length - 1]?.push(qaFrame(`${f.anim}_${f.dir ?? 'r'}_${f.index}`, f.raster, f.meta, f.rootFixed, f.index > 0 ? still : undefined, f.anim, !f.inbetween, f.dir));
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
    // 프리렌더는 방향마다 렌더한 프레임(dir) 그대로, 나머지는 우향 + 좌우 반전 좌향
    if (f.dir) files.push(png(`frames/${f.anim}_${f.dir}_${f.index}.png`, f.raster));
    else files.push(png(`frames/${f.anim}_r_${f.index}.png`, f.raster), png(`frames/${f.anim}_l_${f.index}.png`, mirrorFrame(f.raster)));
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
  const warnings = [...new Set([r.rest, ...r.frames].flatMap((f) => f.meta.warnings))].sort();
  const report: Report = {
    ...runChecks(rows.flat(), qaContext(r.project, r.palette, r.rest), extra), budget: r.rest.meta.budget, sizeClass: r.sizeClass,
    ...(warnings.length ? { warnings } : {}),
  };
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
