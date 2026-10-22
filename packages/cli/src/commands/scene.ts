import { basename, join, relative } from 'node:path';
import { z } from 'zod';
import { addColor, blitInPlace, createIndexed, ForgeError, hexToRgba, scaleNearest, toRGBA } from '@pixel-forge/core';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { encodePng } from '../io/png.js';
import { loadProject } from '../io/project.js';
import { parseSheetScale } from './render.js';
import { renderProject, type Rendered } from './qa.js';

/** data/scenes/<name>.scene.json — 게임 화면 목업: 캐릭터마다 Spec·애니·방향·프레임과 발밑 위치 */
const sceneSchema = z.object({
  /** 화면 크기(px, 1배). 생략하면 바이블 internalResolution */
  size: z.tuple([z.number().int().min(16), z.number().int().min(16)]).optional(),
  scale: z.number().int().min(1).max(16).default(2),
  items: z.array(z.object({
    spec: z.string().min(1),
    anim: z.string().min(1).default('rest'),
    /** 방향(프리렌더 s·se·…). 생략하면 그 애니의 첫 방향 */
    dir: z.string().min(1).optional(),
    index: z.number().int().min(0).default(0),
    /** 발밑 기준점(manifest pivot)이 놓일 화면 좌표 */
    at: z.tuple([z.number().int(), z.number().int()]),
  })).min(1),
});

/** 프레임 고르기: rest 또는 <anim>(+dir)의 index번째 */
function frameOf(r: Rendered, anim: string, dir: string | undefined, index: number) {
  if (anim === 'rest') return r.rest.raster;
  const list = r.frames.filter((f) => f.anim === anim && (dir === undefined || f.dir === dir || (!f.dir && dir === 'r')));
  const first = list[0]?.dir;
  const f = list.filter((g) => g.dir === first)[index];
  if (!f) throw new ForgeError('cli.scene', `프레임이 없습니다: ${r.project.spec.id} ${anim}${dir ? `_${dir}` : ''}_${index}`);
  return f.raster;
}

/** 프레임의 발밑 기준점: 가로 가운데, 가장 아래 불투명 줄 바로 아래(manifest pivot과 같은 규칙) */
function pivotOf(r: Rendered): [number, number] {
  const ras = r.rest.raster;
  let bottom = ras.h - 1;
  for (let k = ras.px.length - 1; k >= 0; k--) if (ras.px[k]) { bottom = Math.floor(k / ras.w); break; }
  return [r.rest.origin[0], bottom + 1];
}

/**
 * 게임 화면 목업(검토용): 바이블 배경 위에 캐릭터를 발밑 y 순으로(뒤 → 앞) 놓는다 → out/scenes/<name>.png(scale배).
 * 같은 Spec은 한 번만 렌더한다. 실제 게임 화면이 아니라 군중 속 판독·크기 비교용.
 */
export function sceneCommand(scenePath: string, cwd: string, scale?: number) {
  const path = resolveInside(join(cwd, 'data', 'scenes'), resolveInside(cwd, scenePath));
  const scene = readJson(path, sceneSchema);
  const k = parseSheetScale(scale ?? scene.scale);
  const cache = new Map<string, Rendered>();
  const rendered = (spec: string) => {
    const hit = cache.get(spec);
    if (hit) return hit;
    const r = renderProject(loadProject(resolveInside(cwd, spec), cwd));
    cache.set(spec, r);
    return r;
  };
  const items = scene.items.map((it) => ({ it, r: rendered(it.spec) }));
  const bible = items[0]?.r.project.bible;
  if (!bible || items.some(({ r }) => r.project.bible.id !== bible.id)) throw new ForgeError('cli.scene', '목업은 바이블 하나를 쓰는 Spec만 놓을 수 있습니다');
  const [w, h] = scene.size ?? bible.internalResolution ?? [320, 180];
  const base = items[0]?.r.palette.palette;
  if (!base) throw new ForgeError('cli.scene', '렌더 결과가 없습니다');
  const { palette, index: bg } = addColor(base, hexToRgba(bible.background), 'scene:bg');
  const canvas = createIndexed(w, h);
  canvas.px.fill(bg);
  for (const { it, r } of [...items].sort((a, b) => a.it.at[1] - b.it.at[1] || a.it.at[0] - b.it.at[0])) {
    const [px, py] = pivotOf(r);
    blitInPlace(canvas, frameOf(r, it.anim, it.dir, it.index), it.at[0] - px, it.at[1] - py);
  }
  const big = scaleNearest(canvas, k);
  const name = basename(path).replace(/\.scene\.json$/, '');
  const out = join(cwd, 'out', 'scenes', `${name}.png`);
  writeFileEnsured(out, encodePng({ w: big.w, h: big.h, rgba: toRGBA(big, palette) }));
  return { ok: true as const, cmd: 'scene', scene: name, items: items.length, specs: cache.size, size: [w, h], scale: k, out: relative(cwd, out) };
}
