import { join, resolve } from 'node:path';
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
  return {
    spec,
    bible: readJson(join(data, 'bibles', `${spec.bible}.bible.json`), bibleSchema),
    rules: readJson(join(data, 'rules', 'default.rules.json'), rulesSchema),
    rig: readJson(join(data, 'rigs', `${spec.rig}.rig.json`), rigSchema),
  };
}
