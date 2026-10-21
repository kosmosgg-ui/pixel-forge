import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { crossChecks, summarize, type Report, type Silhouette } from '@pixel-forge/qa';
import { ForgeError } from '@pixel-forge/core';
import { cacheKey, restoreCache, storeCache } from '../cache.js';
import { decodePng } from '../io/png.js';
import { loadProject, type Project } from '../io/project.js';
import { writePack } from './pack.js';
import { runQaRendered, summary } from './qa.js';

/** validate → render → qa → pack(QA 통과 시만). 같은 입력이면 캐시에서 복원 */
export function buildCommand(specPath: string, cwd: string) {
  return buildProject(specPath, loadProject(specPath, cwd), cwd);
}

/** 이 캐릭터 산출물을 결정하는 입력 파일(절대 경로) — 캐시 키와 watch가 같은 목록을 쓴다 */
export function projectDeps(specPath: string, p: Project, cwd: string): string[] {
  const data = join(cwd, 'data');
  return [
    resolve(cwd, specPath), join(data, 'bibles', `${p.spec.bible}.bible.json`), join(data, 'rigs', `${p.rig.id}.rig.json`),
    join(data, 'rigs', `${p.rig.id}.anims.json`), join(data, 'rules', 'default.rules.json'),
  ];
}

function buildProject(specPath: string, p: Project, cwd: string) {
  const key = cacheKey(projectDeps(specPath, p, cwd));
  const out = join(cwd, 'out', p.spec.id);
  // 지난 빌드(다른 입력·forge qa·pack)의 파일이 캐시 복원·새 빌드에 섞이지 않게 출력 폴더를 비우고 시작
  rmSync(out, { recursive: true, force: true });
  const cached = restoreCache(cwd, key, out);
  if (!cached) {
    const { report, rendered } = runQaRendered(p, cwd);
    if (report.pass) writePack(p, rendered, cwd);
    storeCache(cwd, key, out);
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
