import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { medianCut, quantize } from '@pixel-forge/import';
import type { ProjectTarget } from '@pixel-forge/spec';
import { resolveInside } from '../io/paths.js';
import { resolveOut } from '../io/targets.js';
import { decodePng, encodePng, type RgbaImage } from '../io/png.js';
import { assertCoverage, candidateSchema, covers, rowsOf, type Candidate } from './candidate-contract.js';

interface Sheet { manifest: Candidate; image: RgbaImage; hashes?: { manifestSha256: string; sheetSha256: string } }
function readSheet(dir: string, actor: string): Sheet | undefined {
  const json = join(dir, `${actor}_manifest.json`), png = join(dir, `${actor}_sheet.png`);
  if (!existsSync(json) && !existsSync(png)) return undefined;
  if (!existsSync(json) || !existsSync(png)) throw new ForgeError('make.baseline', `PNG/매니페스트 쌍 필요: ${dir}`);
  const jsonBytes = readFileSync(json), pngBytes = readFileSync(png);
  const manifest = candidateSchema.parse(JSON.parse(jsonBytes.toString('utf8')));
  const image = decodePng(pngBytes);
  if (manifest.assetId !== actor || image.w !== manifest.sheet_size[0] || image.h !== manifest.sheet_size[1]) throw new ForgeError('make.baseline', 'baseline ID/시트 크기 불일치');
  return { manifest, image, hashes: { manifestSha256: createHash('sha256').update(jsonBytes).digest('hex'), sheetSha256: createHash('sha256').update(pngBytes).digest('hex') } };
}
function blitFrame(dst: RgbaImage, src: Sheet, anim: string, dir: string, frame: number, col: number, row: number): void {
  const m = src.manifest, a = m.animations[anim], ry = rowsOf(m)[dir];
  if (!a || ry === undefined) return;
  const [w, h] = m.frame_size;
  for (let y = 0; y < h; y++) {
    const start = ((ry * h + y) * src.image.w + (a.start_column + frame) * w) * 4;
    dst.rgba.set(src.image.rgba.subarray(start, start + w * 4), ((row * h + y) * dst.w + col * w) * 4);
  }
}
function merge(old: Sheet, fresh: Sheet): Sheet {
  const a = old.manifest, b = fresh.manifest;
  if (a.frame_size.join() !== b.frame_size.join() || a.anchor.join() !== b.anchor.join() || a.display_scale !== b.display_scale) throw new ForgeError('make.baseline', 'baseline 셀/앵커/배율은 새 후보와 같아야 합니다');
  const dirs = [...new Set([...Object.keys(rowsOf(a)), ...Object.keys(rowsOf(b))])].sort();
  const names = [...new Set([...Object.keys(a.animations), ...Object.keys(b.animations)])];
  const animations: Candidate['animations'] = {};
  let columns = 0;
  for (const name of names) {
    const before = a.animations[name], next = b.animations[name];
    if (before && next && (before.frames !== next.frames || before.fps !== next.fps)) throw new ForgeError('make.baseline', `방향별 프레임/fps 충돌: ${name}`);
    if (before && next) for (const key of ['loop', 'frame_ms', 'phases', 'hold'] as const) {
      if (before[key] !== undefined && next[key] !== undefined && JSON.stringify(before[key]) !== JSON.stringify(next[key])) throw new ForgeError('make.baseline', `방향별 시간 메타 충돌: ${name}/${key}`);
    }
    const template = { ...before, ...next };
    if (!template.frames || !template.fps) throw new ForgeError('make.baseline', `동작 메타 없음: ${name}`);
    const only = dirs.filter((d) => covers(a, name, d) || covers(b, name, d));
    const mergedClip = { ...template, frames: template.frames, fps: template.fps, loop: template.loop ?? false, start_column: columns, rows_only: only.length === dirs.length ? [] : only };
    if (before?.stride_px !== undefined && !covers(b, name, 'right')) mergedClip.stride_px = before.stride_px;
    animations[name] = mergedClip;
    columns += template.frames;
  }
  const [w, h] = b.frame_size, image = { w: columns * w, h: dirs.length * h, rgba: new Uint8Array(columns * w * dirs.length * h * 4) };
  dirs.forEach((dir, row) => { for (const [name, clip] of Object.entries(animations)) {
    const source = covers(b, name, dir) ? fresh : covers(a, name, dir) ? old : undefined;
    if (source) for (let i = 0; i < clip.frames; i++) blitFrame(image, source, name, dir, i, clip.start_column + i, row);
  } });
  const rows = Object.fromEntries(dirs.map((d, i) => [d, i]));
  const manifest = candidateSchema.parse({ ...b, rows, row_names: dirs, directions: Object.fromEntries(dirs.map((d, i) => [d, { row: i, flip_h: false }])),
    mirror: { ...a.mirror, ...b.mirror }, animations, columns, sheet_size: [image.w, image.h],
    provenance: { ...b.provenance, baseline: { ...old.hashes, provenance: a.provenance, kind: 'derived-candidate-not-original' } },
    qa: { ...b.qa, pass: a.qa.pass && b.qa.pass, warnings: [...a.qa.warnings, ...b.qa.warnings] } });
  assertCoverage(a, manifest);
  return { manifest, image };
}
/** 원본이 없는 부분은 명시적으로 보관한 파생 후보에서만 가져온다. 원본/state를 지어내지 않는다. */
export function finishCandidate(cwd: string, actor: string, png: Buffer, raw: unknown, budget?: number): { png: Buffer; manifest: Candidate } {
  let sheet = { manifest: candidateSchema.parse(raw), image: decodePng(png) };
  const baseline = readSheet(resolveInside(cwd, join('data/import', actor, 'baseline')), actor);
  if (baseline) sheet = merge(baseline, sheet);
  if (baseline || budget !== undefined) delete sheet.manifest.qa['study'];
  if (budget !== undefined) {
    const palette = medianCut([sheet.image], budget), q = quantize(sheet.image, palette);
    for (let i = 0; i < q.px.length; i++) {
      const index = q.px[i] ?? 0;
      if (!index) continue;
      const c = palette[index - 1] ?? 0;
      sheet.image.rgba.set([c >>> 16, (c >>> 8) & 255, c & 255, 255], i * 4);
    }
    const notes = sheet.manifest['notes'];
    sheet.manifest['notes'] = [...(Array.isArray(notes) ? notes.filter((n: unknown) => typeof n === 'string' && !n.startsWith('동작마다 원본이 달라 팔레트가 따로다')) : []), '캐릭터 전체 공통 팔레트 — 기술 후보, 미술/권리 승인 아님'];
    sheet.manifest.provenance['commonPalette'] = { budget, colors: palette.map((c) => `#${c.toString(16).padStart(6, '0')}`), scope: 'character' };
  }
  return { png: encodePng(sheet.image), manifest: sheet.manifest };
}
/** 출력 전에 양쪽 기존 후보의 행/동작을 확인한다. 실패 시 어떤 후보 파일도 덮어쓰지 않는다. */
export function protectCandidate(cwd: string, target: ProjectTarget, actor: string, next: Candidate, local: string, outArg?: string): void {
  const dest = resolveInside(resolveOut(cwd, outArg ?? target.out), join(target.dir, actor));
  for (const dir of new Set([local, dest])) {
    const old = readSheet(dir, actor);
    if (old) assertCoverage(old.manifest, next);
  }
}
