import { join, resolve } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { bibleSchema, rigSchema, rulesSchema, specSchema, type Bible, type Rig, type Rules, type Spec } from '@pixel-forge/spec';
import { readJson } from './files.js';

export interface Project {
  spec: Spec;
  bible: Bible;
  rules: Rules;
  rig: Rig;
}

/** Spec 경로 → Spec + 참조된 바이블·리그 + 기본 규칙. 각 파일은 여기서 한 번만 검증한다 */
export function loadProject(specPath: string, cwd: string): Project {
  const spec = readJson(resolve(cwd, specPath), specSchema);
  const data = join(cwd, 'data');
  const bible = readJson(join(data, 'bibles', `${spec.bible}.bible.json`), bibleSchema);
  const rigId = spec.rig ?? bible.defaultRig;
  if (rigId === undefined) throw new ForgeError('spec.refs', 'rig가 없습니다: Spec rig 또는 바이블 defaultRig를 지정하세요');
  return {
    spec,
    bible,
    rules: readJson(join(data, 'rules', 'default.rules.json'), rulesSchema),
    rig: readJson(join(data, 'rigs', `${rigId}.rig.json`), rigSchema),
  };
}
