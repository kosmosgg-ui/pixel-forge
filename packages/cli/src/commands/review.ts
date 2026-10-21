import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError, toRGBA } from '@pixel-forge/core';
import { reviewSheet } from '@pixel-forge/qa';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { qaRows, renderProject } from './qa.js';

/**
 * 시각 검수 시트 고정: 프로젝트 Spec 전부 × (rest + Spec의 애니 전 프레임, 우향)을 바이블 배경 위에
 * rules.qa.sheetScale배로 → out/<project>/review.png. pixel-reviewer와 보고 문서는 이 파일만 본다.
 */
export function reviewCommand(project: string, cwd: string) {
  const dir = join(cwd, 'data', 'specs', project);
  const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.json')).sort();
  if (!specs.length) throw new ForgeError('cli.no-specs', `Spec이 없습니다: ${relative(cwd, dir)}`);
  const projects = specs.map((f) => loadProject(join(dir, f), cwd));
  const bible = projects[0]?.bible;
  if (!bible || projects.some((p) => p.bible.id !== bible.id)) throw new ForgeError('cli.review-bible', '검수 시트는 바이블 하나를 쓰는 프로젝트만 만들 수 있습니다');
  const rendered = projects.map((p) => renderProject(p));
  const palette = rendered[0]?.palette.palette;
  if (!palette) throw new ForgeError('cli.no-specs', '렌더 결과가 없습니다');
  const chars = rendered.map((r) => qaRows(r).map((row) => row.map((f) => f.raster)));
  const scale = projects[0]?.rules.qa.sheetScale ?? 4;
  const sheet = reviewSheet(chars, palette, { scale, background: bible.background });
  const out = join(cwd, 'out', project, 'review.png');
  writeFileEnsured(out, encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  return {
    ok: true as const, cmd: 'review', project, kinds: specs.length, rows: specs.map((f) => f.replace('.spec.json', '')),
    frames: chars.map((c) => c.flat().length), size: [sheet.raster.w, sheet.raster.h], scale, out: relative(cwd, out),
  };
}
