import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError, scaleNearest, toRGBA } from '@pixel-forge/core';
import { crowdSheet } from '@pixel-forge/qa';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { renderProject } from './qa.js';

/**
 * QA crowd.readability 재료(§1 원칙 6): 프로젝트 Spec들의 rest 프레임을 바이블 내부 해상도(실제 화면 1배) 위에
 * 시드 PRNG로 count개 배치 → out/<project>/crowd.png + crowd@2x.png. 판정은 pixel-reviewer.
 */
export function crowdCommand(project: string, cwd: string, count: number, seed: number) {
  const dir = join(cwd, 'data', 'specs', project);
  const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.json')).sort();
  if (!specs.length) throw new ForgeError('cli.no-specs', `Spec이 없습니다: ${relative(cwd, dir)}`);
  const projects = specs.map((f) => loadProject(join(dir, f), cwd));
  const bible = projects[0]?.bible;
  if (!bible || projects.some((p) => p.bible.id !== bible.id)) throw new ForgeError('cli.crowd-bible', '군중 시트는 바이블 하나를 쓰는 프로젝트만 만들 수 있습니다');
  const [w, h] = bible.internalResolution ?? (() => { throw new ForgeError('cli.crowd-size', `바이블 ${bible.id}에 internalResolution이 없습니다`); })();
  const rendered = projects.map((p) => renderProject(p, []));
  const palette = rendered[0]?.palette.palette;
  if (!palette) throw new ForgeError('cli.no-specs', '렌더 결과가 없습니다');
  const sheet = crowdSheet(rendered.map((r) => r.rest.raster), palette, { w, h, count, seed, background: bible.background });
  const out = join(cwd, 'out', project);
  const big = scaleNearest(sheet.raster, 2);
  writeFileEnsured(join(out, 'crowd.png'), encodePng({ w, h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  writeFileEnsured(join(out, 'crowd@2x.png'), encodePng({ w: big.w, h: big.h, rgba: toRGBA(big, sheet.palette) }));
  return { ok: true as const, cmd: 'crowd', project, kinds: specs.length, count: sheet.placements.length, seed, size: [w, h], out: relative(cwd, join(out, 'crowd.png')) };
}
