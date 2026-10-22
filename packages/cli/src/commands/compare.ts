import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createIndexed, ForgeError, toRGBA, type IndexedRaster } from '@pixel-forge/core';
import { reviewSheet } from '@pixel-forge/qa';
import { writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { renderProject, type Rendered } from './qa.js';

const REF_DIR = 'docs/quality-ref';

/** 비교 칸 = rest + attack 전 프레임(우향) — 모드 차이가 가장 크게 드러나는 동작 */
function columnOf(r: Rendered): IndexedRaster[] {
  return [r.rest.raster, ...r.frames.filter((f) => f.anim === 'attack').map((f) => f.raster)];
}

/** 시안이 없을 때의 자리 표시: 외곽선색 테두리 + X(빈 칸과 구분) */
function placeholder(w: number, h: number, ink: number): IndexedRaster {
  const r = createIndexed(w, h);
  for (let i = 0; i < Math.min(w, h); i++) { r.px[i * w + i] = ink; r.px[i * w + (w - 1 - i)] = ink; }
  for (let x = 0; x < w; x++) { r.px[x] = ink; r.px[(h - 1) * w + x] = ink; }
  for (let y = 0; y < h; y++) { r.px[y * w] = ink; r.px[y * w + w - 1] = ink; }
  return r;
}

/**
 * 모드 비교 시트: 줄마다 Spec 묶음(쉼표 구분)을 같은 배경·배율로 나란히, 끝 칸은 docs/quality-ref/<줄 마지막 Spec id>.png 시안.
 * 시안 이미지는 아직 인덱스 변환을 하지 않아(외부 이미지 → 팔레트 매핑은 별도 단계) 자리 표시로 두고 missingRefs에 적는다.
 */
export function compareCommand(outPath: string, rows: readonly string[], cwd: string) {
  if (!rows.length) throw new ForgeError('cli.no-specs', '비교할 Spec 줄이 없습니다: forge compare <out.png> <a.spec.json,b.spec.json> ...');
  // 비교 시트는 산출물이 아니라 검토용 — out/ 안에만 쓴다
  const out = resolveInside(join(cwd, 'out'), resolveInside(cwd, outPath));
  const lines = rows.map((row) => row.split(',').filter(Boolean).map((s) => loadProject(s, cwd)));
  const all = lines.flat();
  const bible = all[0]?.bible;
  if (!bible || all.some((p) => p.bible.id !== bible.id)) throw new ForgeError('cli.review-bible', '비교 시트는 바이블 하나를 쓰는 Spec만 만들 수 있습니다');
  const rendered = lines.map((ps) => ps.map((p) => renderProject(p)));
  const first = rendered[0]?.[0];
  if (!first) throw new ForgeError('cli.no-specs', '렌더 결과가 없습니다');
  const missingRefs: string[] = [];
  const chars = rendered.map((rs, i) => {
    const groups = rs.map(columnOf);
    const id = lines[i]?.at(-1)?.spec.id ?? '';
    const ref = join(REF_DIR, `${id}.png`);
    if (!existsSync(join(cwd, ref))) missingRefs.push(ref);
    const r0 = rs[0]?.rest.raster ?? first.rest.raster;
    groups.push([placeholder(r0.w, r0.h, first.palette.outlineIndex)]);
    return groups;
  });
  const scale = all[0]?.rules.qa.sheetScale ?? 4;
  const cols = Math.max(...chars.map((gs) => gs.reduce((a, g) => a + g.length, 0)));
  const sheet = reviewSheet(chars, first.palette.palette, { scale, background: bible.background, cols });
  writeFileEnsured(out, encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  return {
    ok: true as const, cmd: 'compare', rows: lines.map((ps) => ps.map((p) => p.spec.id)),
    missingRefs, size: [sheet.raster.w, sheet.raster.h], scale, out: relative(cwd, out),
  };
}
