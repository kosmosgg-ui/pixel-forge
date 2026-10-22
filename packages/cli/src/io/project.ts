import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { animsFileSchema, bibleSchema, rigSchema, rulesSchema, specSchema, type AnimsFile, type Bible, type Rig, type Rules, type Spec } from '@pixel-forge/spec';
import { readJson } from './files.js';
import { prerenderLoader, type PrerenderInput } from './prerender.js';

export interface Project {
  spec: Spec;
  bible: Bible;
  rules: Rules;
  rig: Rig;
  /** data/rigs/<rig>.anims.json (없으면 rest만) */
  anims: AnimsFile | null;
  /** 프리렌더 모드: Blender 패스를 준비하는 함수(렌더할 때만 부른다) */
  prerender?: () => PrerenderInput;
}

/** Spec 경로 → Spec + 참조된 바이블·리그 + 기본 규칙. 각 파일은 여기서 한 번만 검증한다 */
export function loadProject(specPath: string, cwd: string): Project {
  const spec = readJson(resolve(cwd, specPath), specSchema);
  const data = join(cwd, 'data');
  const bible = readJson(join(data, 'bibles', `${spec.bible}.bible.json`), bibleSchema);
  // Spec rig → 크기 등급 기본 리그 → 바이블 기본 리그
  const rigId = spec.rig ?? bible.sizeClassOptions[spec.sizeClass]?.rig ?? bible.defaultRig;
  if (rigId === undefined) throw new ForgeError('spec.refs', 'rig가 없습니다: Spec rig 또는 바이블 defaultRig를 지정하세요');
  const animsPath = join(data, 'rigs', `${rigId}.anims.json`);
  const rules = readJson(join(data, 'rules', 'default.rules.json'), rulesSchema);
  return {
    spec,
    bible,
    rules,
    ...(spec.mode === 'prerender' ? { prerender: once(prerenderLoader(spec, bible, rules, cwd)) } : {}),
    rig: readJson(join(data, 'rigs', `${rigId}.rig.json`), rigSchema),
    anims: existsSync(animsPath) ? readJson(animsPath, animsFileSchema) : null,
  };
}

/** 한 번만 실행하고 결과를 기억(렌더 여러 번 → Blender·PNG 읽기 1번) */
function once<T>(f: () => T): () => T {
  let v: { r: T } | undefined;
  return () => (v ??= { r: f() }).r;
}
