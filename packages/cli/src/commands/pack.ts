import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FORGE_VERSION, ForgeError, toRGBA, type IndexedRaster } from '@pixel-forge/core';
import { buildManifest, packCharacter } from '@pixel-forge/export';
import { resolveMotion } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { packFiles } from './pack-files.js';
import { defaultAnims, renderProject, type Rendered } from './qa.js';

export const PACK_FORMATS = ['aseprite-json'] as const;

export { packFiles } from './pack-files.js';

/** 렌더 결과 → out/<id>/{<id>.png, <id>.json(Aseprite 호환), manifest.json} (§10) */
export function writePack(r: Rendered, cwd: string): string[] {
  // 크기 등급을 맞춘 Spec(manifest sizeClass = 실제 등급)
  const p = r.project;
  const dir = join(cwd, 'out', p.spec.id);
  const W = r.rest.raster.w;
  // 바이블 facing이 리그와 다르면 렌더가 좌우 반전했으므로 루트 x도 반전
  const rootX = p.bible.facing !== p.rig.facing ? W - 1 - r.rest.origin[0] : r.rest.origin[0];
  const loops = p.spec.mode === 'frames' || p.spec.mode === 'prerender'
    ? Object.fromEntries(defaultAnims(p).map((k) => [k, p.spec.loop.includes(k)]))
    : Object.fromEntries(Object.entries(p.anims?.anims ?? {}).map(([k, a]) => [k, a.loop]));
  const packed = packCharacter({
    id: p.spec.id, bible: p.bible.id, sizeClass: p.spec.sizeClass, rest: r.rest.raster, rootX,
    frames: r.frames.map((f) => ({ anim: f.anim, index: f.index, raster: f.raster, ms: f.ms, ...(f.dir ? { dir: f.dir } : {}) })),
    ...(p.spec.mode === 'prerender' && new Set(r.frames.map((f) => f.dir)).size === 1 ? { mirror: true } : {}),
    loops, motion: { ...resolveMotion(p.bible.motion, p.spec.motion), shadow: shadowOf(r.rest.raster) }, palette: r.palette.palette, version: FORGE_VERSION,
  }, `${p.spec.id}.png`);
  const png = encodePng({ w: packed.sheet.w, h: packed.sheet.h, rgba: toRGBA(packed.sheet, r.palette.palette) });
  const [img = '', data = '', manifest = ''] = packFiles(p.spec.id);
  writeFileEnsured(join(dir, img), png);
  writeFileSync(join(dir, data), JSON.stringify(packed.json, null, 1) + '\n');
  const hash = createHash('sha256').update(png).digest('hex');
  writeFileSync(join(dir, manifest), JSON.stringify(buildManifest({ ...packed.manifest, hash }), null, 2) + '\n');
  return [img, data, manifest].map((f) => relative(cwd, join(dir, f)));
}

/** forge pack: 렌더 → 패킹만(QA 없음, 개발용). 게임에 넣는 산출물은 QA를 거치는 build·apply로 */
export function packCommand(specPath: string, cwd: string, format = 'aseprite-json') {
  if (!(PACK_FORMATS as readonly string[]).includes(format)) {
    throw new ForgeError('cli.format', `지원하지 않는 형식: ${format} (지원: ${PACK_FORMATS.join(', ')})`);
  }
  const p = loadProject(specPath, cwd);
  const r = renderProject(p);
  const files = writePack(r, cwd);
  // 시트 프레임 = rest 1 + 애니 프레임
  const frames = 1 + r.frames.length;
  return { ok: true as const, cmd: 'pack', id: p.spec.id, format, frames, out: files[0], files };
}

/** 바닥 그림자 힌트(엔진이 그린다, 스프라이트에 굽지 않음): 폭 = rest 가장 아래 불투명 줄의 폭 + 4, 높이 3 */
export function shadowOf(r: IndexedRaster): { w: number; h: number } {
  for (let y = r.h - 1; y >= 0; y--) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < r.w; x++) if (r.px[y * r.w + x]) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 >= 0) return { w: x1 - x0 + 1 + 4, h: 3 };
  }
  return { w: 4, h: 3 };
}
