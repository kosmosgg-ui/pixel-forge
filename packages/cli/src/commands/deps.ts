import { join, resolve } from 'node:path';
import type { Project } from '../io/project.js';
import { prerenderDeps } from '../io/prerender.js';

/** 이 캐릭터 산출물을 결정하는 입력 파일(절대 경로) — 캐시 키와 watch가 같은 목록을 쓴다 */
export function projectDeps(specPath: string, p: Project, cwd: string): string[] {
  const data = join(cwd, 'data');
  return [
    resolve(cwd, specPath), join(data, 'bibles', `${p.spec.bible}.bible.json`), join(data, 'rigs', `${p.rig.id}.rig.json`),
    join(data, 'rigs', `${p.rig.id}.anims.json`), join(data, 'rules', 'default.rules.json'), ...prerenderDeps(p.spec, cwd),
  ];
}
