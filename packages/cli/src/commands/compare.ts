import { existsSync } from 'node:fs';
import { z } from 'zod';
import { frameGridSchema } from '@pixel-forge/spec';
import { join, relative } from 'node:path';
import { createIndexed, ForgeError, toRGBA, type IndexedRaster } from '@pixel-forge/core';
import { reviewSheet } from '@pixel-forge/qa';
import { resolveInside } from '../io/paths.js';
import { encodePng } from '../io/png.js';
import { readJson, writeFileEnsured } from '../io/files.js';
import { loadProject, type Project } from '../io/project.js';
import { renderProject, type Rendered } from './qa.js';

const REF_DIR = 'docs/quality-ref';
/** 시안 그리드: id → 프레임 모드 rest 그리드(툴 범례, 바깥 외곽선 없음) */
const REF_GRIDS = join(REF_DIR, 'target-grids.json');
const refGridsSchema = z.record(z.string(), frameGridSchema);

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
 * 시안 그리드를 그 Spec의 rest base로 바꿔 같은 엔진(외곽선·특수 칸)으로 렌더 — 색 예산은 풀어 시안 색 그대로.
 * 예산 병합으로 생기는 차이도 refDiff에 드러나야 시안 대비 손실을 판단할 수 있다.
 */
function renderRef(p: Project, grid: z.infer<typeof frameGridSchema>): IndexedRaster {
  const bible = { ...p.bible, colorBudget: { ...p.bible.colorBudget, [p.spec.sizeClass]: Infinity } };
  return renderProject({ ...p, bible, spec: { ...p.spec, mode: 'frames', parts: [], grid, frames: {}, loop: [] } }, []).rest.raster;
}

const diffCount = (a: IndexedRaster, b: IndexedRaster): number => {
  if (a.w !== b.w || a.h !== b.h) return Math.max(a.px.length, b.px.length);
  let n = 0;
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) n++;
  return n;
};

/**
 * 모드 비교 시트: 줄마다 Spec 묶음(쉼표 구분, rest + attack)을 같은 배경·배율로 나란히, 끝 칸은 시안.
 * 시안 = docs/quality-ref/target-grids.json의 <줄 마지막 Spec id> 그리드를 엔진으로 렌더한 rest(예산 무제한). 없으면 X 자리 표시 + missingRefs.
 * refDiff = 줄 마지막 Spec rest와 시안 렌더의 다른 픽셀 수(외곽선·예산 병합 포함, 0이면 일치).
 */
export function compareCommand(outPath: string, rows: readonly string[], cwd: string, scale?: number) {
  if (!rows.length) throw new ForgeError('cli.no-specs', '비교할 Spec 줄이 없습니다: forge compare <out.png> <a.spec.json,b.spec.json> ...');
  // 비교 시트는 산출물이 아니라 검토용 — out/ 안에만 쓴다
  const out = resolveInside(join(cwd, 'out'), resolveInside(cwd, outPath));
  const lines = rows.map((row) => row.split(',').filter(Boolean).map((s) => loadProject(s, cwd)));
  const all = lines.flat();
  const bible = all[0]?.bible;
  if (!bible || all.some((p) => p.bible.id !== bible.id)) throw new ForgeError('cli.review-bible', '비교 시트는 바이블 하나를 쓰는 Spec만 만들 수 있습니다');
  const refs = existsSync(join(cwd, REF_GRIDS)) ? readJson(join(cwd, REF_GRIDS), refGridsSchema) : {};
  const rendered = lines.map((ps) => ps.map((p) => renderProject(p)));
  const first = rendered[0]?.[0];
  if (!first) throw new ForgeError('cli.no-specs', '렌더 결과가 없습니다');
  const missingRefs: string[] = [];
  const refDiff: Record<string, number> = {};
  const chars = rendered.map((rs, i) => {
    const groups = rs.map(columnOf);
    const last = lines[i]?.at(-1), lastR = rs.at(-1);
    const ref = last ? refs[last.spec.id] : undefined;
    if (last && lastR && ref) {
      const r = renderRef(last, ref);
      refDiff[last.spec.id] = diffCount(r, lastR.rest.raster);
      groups.push([r]);
    } else {
      missingRefs.push(`${REF_GRIDS}#${last?.spec.id ?? ''}`);
      const r0 = lastR?.rest.raster ?? first.rest.raster;
      groups.push([placeholder(r0.w, r0.h, first.palette.outlineIndex)]);
    }
    return groups;
  });
  const k = scale ?? all[0]?.rules.qa.sheetScale ?? 4;
  const cols = Math.max(...chars.map((gs) => gs.reduce((a, g) => a + g.length, 0)));
  const sheet = reviewSheet(chars, first.palette.palette, { scale: k, background: bible.background, cols });
  writeFileEnsured(out, encodePng({ w: sheet.raster.w, h: sheet.raster.h, rgba: toRGBA(sheet.raster, sheet.palette) }));
  return {
    ok: true as const, cmd: 'compare', rows: lines.map((ps) => ps.map((p) => p.spec.id)),
    refDiff, missingRefs, size: [sheet.raster.w, sheet.raster.h], scale: k, out: relative(cwd, out),
  };
}
