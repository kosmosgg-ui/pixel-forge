import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { crossChecks, summarize, type Report, type Silhouette } from '@pixel-forge/qa';
import { ForgeError } from '@pixel-forge/core';
import { cacheKey, restoreCache, storeCache } from '../cache.js';
import { decodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { writePack } from './pack.js';
import { projectDeps } from './deps.js';
import { runQaRendered, summary } from './qa.js';
import { keepReview } from './review-gate.js';

/** validate → render → qa → pack(QA 통과 시만). 같은 입력이면 캐시에서 복원 */
export function buildCommand(specPath: string, cwd: string) {
  return buildProject(specPath, loadProject(specPath, cwd), cwd);
}

export { projectDeps } from './deps.js';

function buildProject(specPath: string, p: Project, cwd: string) {
  const key = cacheKey(projectDeps(specPath, p, cwd));
  const out = join(cwd, 'out', p.spec.id);
  // 지난 빌드(다른 입력·forge qa·pack)의 파일이 캐시 복원·새 빌드에 섞이지 않게 출력 폴더를 비우고 시작
  // 검수 기록(review.json)은 캐시에 넣지 않고 지운 뒤 되살린다 — 입력과 맞는지는 apply가 키로 확인
  const cached = keepReview(out, () => {
    rmSync(out, { recursive: true, force: true });
    if (restoreCache(cwd, key, out)) return true;
    const { report, rendered } = runQaRendered(p, cwd);
    if (report.pass) writePack(rendered, cwd);
    storeCache(cwd, key, out);
    return false;
  });
  const report = JSON.parse(readFileSync(join(out, 'qa.json'), 'utf8')) as Report;
  return { ok: true as const, cmd: 'build', id: p.spec.id, ...summary(report), ...(report.sizeClass ? { sizeClass: report.sizeClass } : {}), cached, out: relative(cwd, out) };
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
    // 교차 검사(scale.consistency)는 실제로 쓴 등급끼리 비교
    return { id: b.id, sizeClass: b.sizeClass?.used ?? b.project.spec.sizeClass, w: img.w, h: img.h, mask };
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
    const report: Report = { ...merged, budget: prev.budget, ...(prev.sizeClass ? { sizeClass: prev.sizeClass } : {}), sheet: { ...prev.sheet, legend: merged.sheet.legend } };
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    const s = summary(report);
    if (s.pass) passCount++;
    if (s.failed.length) failed[b.id] = s.failed;
  }
  return { ok: true as const, cmd: 'build-all', project, count: builds.length, passed: passCount, pass: passCount === builds.length, failed, cached: builds.filter((b) => b.cached).length, out: 'out' };
}
