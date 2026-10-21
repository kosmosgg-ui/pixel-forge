import { join, relative } from 'node:path';
import { buildBiblePalette, toRGBA } from '@pixel-forge/core';
import { renderFrame } from '@pixel-forge/render';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { validateProject } from './validate.js';

/** P2: rest pose 1프레임 → out/<id>/frames/rest.png */
export function renderCommand(specPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  validateProject(p);
  const palette = buildBiblePalette(p.bible, p.rules);
  const { raster, clipped, meta } = renderFrame({ ...p, palette });
  const out = join(cwd, 'out', p.spec.id, 'frames', 'rest.png');
  writeFileEnsured(out, encodePng({ w: raster.w, h: raster.h, rgba: toRGBA(raster, palette.palette) }));
  const used = new Set(raster.px);
  used.delete(0);
  return {
    ok: true as const, cmd: 'render', id: p.spec.id, frames: 1, size: [raster.w, raster.h], colors: used.size,
    budget: `${meta.budget.before}→${meta.budget.after}/${meta.budget.limit}`, merges: meta.budget.merges.length, clipped, out: relative(cwd, out),
  };
}
