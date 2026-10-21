import { join, relative } from 'node:path';
import { loadProject } from '../io/project.js';
import { renderProject, writeFrames } from './qa.js';

/**
 * 인자 없이: rest 1프레임 → out/<id>/frames/rest.png
 * --anim a,b: rest + 그 애니들(색 예산은 함께 맞춤) → frames/<anim>_r_<n>.png, 좌향 _l_
 */
export function renderCommand(specPath: string, cwd: string, anims: readonly string[] = []) {
  const p = loadProject(specPath, cwd);
  const r = renderProject(p, anims);
  const dir = join(cwd, 'out', p.spec.id);
  const files = writeFrames(dir, r);
  const all = [r.rest.raster, ...r.frames.map((f) => f.raster)];
  const used = new Set(all.flatMap((x) => Array.from(x.px)));
  used.delete(0);
  const { budget } = r.rest.meta;
  return {
    ok: true as const, cmd: 'render', id: p.spec.id, frames: all.length, size: [r.rest.raster.w, r.rest.raster.h], colors: used.size,
    budget: `${budget.before}→${budget.after}/${budget.limit}`, merges: budget.merges.length, clipped: r.rest.clipped,
    out: relative(cwd, join(dir, files.length === 1 ? (files[0] ?? '') : 'frames')),
  };
}
