import { join, relative } from 'node:path';
import { ForgeError, toRGBA } from '@pixel-forge/core';
import { reviewSheet } from '@pixel-forge/qa';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { qaRows, renderProject, writeFrames, type Rendered } from './qa.js';

/**
 * 인자 없이: rest 1프레임 → out/<id>/frames/rest.png
 * --anim a,b: rest + 그 애니들(색 예산은 함께 맞춤) → frames/<anim>_r_<n>.png, 좌향 _l_
 * --sheet k: 스튜디오 시트 1장(rest + Spec 애니 전 프레임, 바이블 배경, k배) → out/<id>/studio.png (pixel-studio 루프)
 */
/** 검수·비교 시트 배율: 1~16 정수(render·compare·review-score 공통) — 파일을 쓰기 전에 검사한다 */
export function parseSheetScale(k: number): number {
  if (!Number.isInteger(k) || k < 1 || k > 16) throw new ForgeError('cli.args', `--sheet는 1~16 정수여야 합니다: ${k}`);
  return k;
}

export function renderCommand(specPath: string, cwd: string, anims: readonly string[] = [], sheet?: number) {
  if (sheet !== undefined) parseSheetScale(sheet);
  const p = loadProject(specPath, cwd);
  const r = sheet === undefined ? renderProject(p, anims) : renderProject(p);
  const dir = join(cwd, 'out', p.spec.id);
  const files = writeFrames(dir, r);
  if (sheet !== undefined) {
    writeFileEnsured(join(dir, 'studio.png'), studioPng(r, p.bible.background, sheet));
    files.push('studio.png');
  }
  const all = [r.rest.raster, ...r.frames.map((f) => f.raster)];
  const used = new Set(all.flatMap((x) => Array.from(x.px)));
  used.delete(0);
  const { budget } = r.rest.meta;
  return {
    ok: true as const, cmd: 'render', id: p.spec.id, frames: all.length, size: [r.rest.raster.w, r.rest.raster.h], colors: used.size,
    budget: `${budget.before}→${budget.after}/${budget.limit}`, merges: budget.merges.length, clipped: r.rest.clipped,
    out: relative(cwd, join(dir, sheet !== undefined ? 'studio.png' : files.length === 1 ? (files[0] ?? '') : 'frames')),
  };
}

/** 캐릭터 1종 시트(rest + 전 프레임, 게임 배경, k배) PNG 바이트 — pixel-studio·검수 기록(sheetHash)이 같은 함수로 만든다 */
export function studioPng(r: Rendered, background: string, scale: number): Buffer {
  const s = reviewSheet([qaRows(r).map((row) => row.map((f) => f.raster))], r.palette.palette, { scale, background });
  return encodePng({ w: s.raster.w, h: s.raster.h, rgba: toRGBA(s.raster, s.palette) });
}
