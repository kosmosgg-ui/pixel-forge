import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import { readJson } from './files.js';
import { resolveInside } from './paths.js';

/** 작업 폴더 밖 출력 허용 목록. 사람이 직접 쓰는 로컬 파일(gitignore) — forge·클로드는 쓰지 않는다 */
export const TARGETS_FILE = join('.forge', 'targets.local.json');

const targetsSchema = z.object({
  targets: z.record(z.string().min(1), z.string().min(1).refine(isAbsolute, '절대 경로여야 합니다')),
});

/**
 * --out 해석: `@<이름>`은 허용 목록의 절대 경로, 그 밖은 작업 폴더 안 상대 경로(resolveInside).
 * 목록에 없는 이름·바깥 경로는 io.path-escape.
 */
export function resolveOut(cwd: string, out: string): string {
  if (!out.startsWith('@')) return resolveInside(cwd, out);
  const name = out.slice(1);
  const file = join(cwd, TARGETS_FILE);
  if (!existsSync(file)) {
    throw new ForgeError('io.path-escape', `허용 목록 ${TARGETS_FILE}이 없습니다. 직접 만드세요: {"targets": {"${name || '<이름>'}": "<절대경로>"}}`, { file: TARGETS_FILE });
  }
  const { targets } = readJson(file, targetsSchema);
  const path = targets[name];
  if (path === undefined) {
    throw new ForgeError('io.path-escape', `허용 목록에 없는 대상: @${name} (${TARGETS_FILE}의 targets: ${Object.keys(targets).join(', ') || '없음'})`, { name });
  }
  return path;
}
