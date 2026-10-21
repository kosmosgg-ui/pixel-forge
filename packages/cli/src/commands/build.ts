import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { crossChecks, summarize, type Report, type Silhouette } from '@pixel-forge/qa';
import { ForgeError } from '@pixel-forge/core';
import { cacheKey, restoreCache, storeCache } from '../cache.js';
import { decodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { OUT_FILES, runQa, summary } from './qa.js';

/** validate → render → qa (pack은 P5). 같은 입력이면 캐시에서 복원 */
export function buildCommand(specPath: string, cwd: string) {
  return buildProject(specPath, loadProject(specPath, cwd), cwd);
}

function buildProject(specPath: string, p: Project, cwd: string) {
  const data = join(cwd, 'data');
  const key = cacheKey([
    resolve(cwd, specPath), join(data, 'bibles', `${p.spec.bible}.bible.json`), join(data, 'rigs', `${p.rig.id}.rig.json`),
    join(data, 'rigs', `${p.rig.id}.anims.json`), join(data, 'rules', 'default.rules.json'),
  ]);
  const out = join(cwd, 'out', p.spec.id);
  const cached = restoreCache(cwd, key, out);
  if (!cached) {
    runQa(p, cwd);
    storeCache(cwd, key, out, OUT_FILES);
  }
  const report = JSON.parse(readFileSync(join(out, 'qa.json'), 'utf8')) as Report;
  return { ok: true as const, cmd: 'build', id: p.spec.id, ...summary(report), cached, out: relative(cwd, out) };
}

/** 프로젝트 전체 build + 교차 검사(form.silhouette, scale.consistency)를 각 qa.json에 더한다 */
export function buildAllCommand(project: string, cwd: string) {
  const dir = join(cwd, 'data', 'specs', project);
  const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.json')).sort();
  if (!specs.length) throw new ForgeError('cli.no-specs', `Spec이 없습니다: ${relative(cwd, dir)}`);
  const builds = specs.map((f) => {
    const p = loadProject(join(dir, f), cwd);
    return { project: p, ...buildProject(join(dir, f), p, cwd) };
  });
  const sils: Silhouette[] = builds.map((b) => {
    const img = decodePng(readFileSync(join(cwd, b.out, 'frames', 'rest.png')));
    const mask = new Uint8Array(img.w * img.h).map((_, i) => ((img.rgba[i * 4 + 3] ?? 0) > 0 ? 1 : 0));
    return { id: b.id, sizeClass: b.project.spec.sizeClass, w: img.w, h: img.h, mask };
  });
  const rules = (builds[0]?.project ?? loadProject(join(dir, specs[0] ?? ''), cwd)).rules.qa;
  const cross = crossChecks(sils, rules.silhouetteIoUMax, rules.scaleTolerance);
  const failed: Record<string, string[]> = {};
  let passCount = 0;
  for (const b of builds) {
    const path = join(cwd, b.out, 'qa.json');
    const prev = JSON.parse(readFileSync(path, 'utf8')) as Report;
    const own = prev.checks.filter((c) => c.id !== 'form.silhouette' && c.id !== 'scale.consistency');
    const merged = summarize(prev.id, [...own, ...(cross.get(b.id) ?? [])]);
    const report: Report = { ...merged, budget: prev.budget, sheet: { ...prev.sheet, legend: merged.sheet.legend } };
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    const s = summary(report);
    if (s.pass) passCount++;
    if (s.failed.length) failed[b.id] = s.failed;
  }
  return { ok: true as const, cmd: 'build-all', project, count: builds.length, passed: passCount, pass: passCount === builds.length, failed, cached: builds.filter((b) => b.cached).length, out: 'out' };
}
