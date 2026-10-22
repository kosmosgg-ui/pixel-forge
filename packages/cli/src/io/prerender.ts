import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import { BOTTOM_GAP, type PrerenderOptions, type PrerenderPasses } from '@pixel-forge/render';
import { bpyPython, DIRECTIONS, ELEVATION, PASS_SCRIPT, readPasses, renderPasses, yawsOf } from '@pixel-forge/render3d';
import { sampleFramesOf, type Bible, type Rules, type Spec } from '@pixel-forge/spec';
import { readJson } from './files.js';
import { resolveInside } from './paths.js';

/** data/models/<id>/source.json — 출처·라이선스 기록 필수(모델 파일은 저장소에 넣지 않는다) */
const sourceSchema = z.object({ file: z.string().min(1), url: z.string().min(1), author: z.string().min(1), license: z.string().min(1) }).passthrough();
/** data/models/<id>/materials.json — 모델 재질 이름 → 바이블 재질 */
/** data/models/<id>/materials.json — 모델 재질 이름 → 바이블 재질 | "@eye" | "@eye:<재질>:<단계>" | "@palette".
 * palette: 팔레트형 텍스처(재질 하나에 여러 색)의 색 영역 표 — 견본 색(hex)마다 대상. 알베도와 가장 가까운 견본(OKLab)으로 */
const materialsSchema = z.object({
  bible: z.string().optional(),
  map: z.record(z.string(), z.string()).default({}),
  palette: z.record(z.string(), z.array(z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), to: z.string().min(1), note: z.string().optional() })).min(1)).optional(),
});

export interface PrerenderInput {
  options: PrerenderOptions;
  /** Spec 방향 수의 기본 방향 이름 → 회전(도) */
  yaws: Record<string, number>;
  /** 패스 렌더(같은 입력은 캐시). frames를 주면 그 프레임만(방향 고르기용 1장 등) */
  render: (yaws: Record<string, number>, frames?: Record<string, number[]>) => PrerenderPasses;
}

/** 캐시 키(build)에 넣을 파일: 모델·재질 매핑·출처·Blender 스크립트 */
export function prerenderDeps(spec: Spec, cwd: string): string[] {
  if (spec.mode !== 'prerender' || !spec.model) return [];
  const model = resolve(cwd, spec.model), dir = dirname(model);
  return [model, join(dir, 'materials.json'), join(dir, 'source.json'), PASS_SCRIPT];
}

/**
 * 프리렌더 입력을 준비하는 함수(렌더할 때만 부른다 — Blender 실행은 수십 초).
 * 모델 경로는 data/models 안이어야 하고(io.path-escape), source.json·materials.json이 있어야 한다.
 */
export function prerenderLoader(spec: Spec, bible: Bible, rules: Rules, cwd: string): () => PrerenderInput {
  return () => {
    const model = resolveInside(join(cwd, 'data', 'models'), resolve(cwd, spec.model ?? ''));
    const dir = dirname(model);
    if (!existsSync(model)) throw new ForgeError('render3d.no-model', `모델 파일이 없습니다: ${spec.model} (넣는 방법: data/models/README.md)`);
    for (const f of ['source.json', 'materials.json']) {
      if (!existsSync(join(dir, f))) throw new ForgeError('render3d.no-meta', `${join(dir, f)}가 없습니다 — 출처·라이선스(source.json)와 재질 매핑(materials.json)은 필수(data/models/README.md)`);
    }
    readJson(join(dir, 'source.json'), sourceSchema);
    const { map, palette } = readJson(join(dir, 'materials.json'), materialsSchema);
    const size = bible.sizeClasses[spec.sizeClass];
    if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${spec.sizeClass}`);
    if (!bible.pixelsPerUnit && !spec.height) throw new ForgeError('spec.refs', '프리렌더 배율이 없습니다: 바이블 pixelsPerUnit 또는 Spec height(목표 키 px)');
    const all = sampleFramesOf(spec);
    const { supersample, margin, toon } = rules.prerender;
    const blender = { python: bpyPython(cwd, process.env), cacheRoot: join(cwd, '.forge-cache', 'prerender') };
    const render = (yaws: Record<string, number>, frames: Record<string, number[]> = all) => {
      // 프레이밍은 늘 전 애니·전 프레임 기준(방향 고르기용 1장 렌더도 같은 배율·위치가 되게)
      const passDir = renderPasses({
        model, size: [size[0], size[1]], supersample, height: spec.height ?? size[1], elevation: ELEVATION[spec.camera], margin, bottomGap: BOTTOM_GAP,
        actions: spec.actions ?? {}, frames, frameAll: all, yaws, yawsAll: { ...DIRECTIONS[8] }, hide: spec.hide, ...(bible.pixelsPerUnit ? { pxPerUnit: bible.pixelsPerUnit } : {}),
      }, blender);
      return readPasses(passDir, size, supersample, frames);
    };
    return { options: { materialMap: map, ...(palette ? { palette } : {}), toon }, yaws: yawsOf(spec.directions), render };
  };
}
