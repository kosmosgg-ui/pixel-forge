import { join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { getAdapter } from '../adapters/index.js';
import { resolveOut } from '../io/targets.js';
import { loadProject } from '../io/project.js';
import { buildCommand } from './build.js';
import { packFiles } from './pack-files.js';

export interface ApplyArgs {
  target?: string;
  out?: string;
}

/** build(캐시·QA) → 통과하면 어댑터로 게임 폴더에 복사. QA 불합격이면 복사하지 않고 pass:false(exit 2) */
export function applyCommand(specPath: string, cwd: string, args: ApplyArgs = {}) {
  const p = loadProject(specPath, cwd);
  const target = args.target ?? p.bible.apply?.target ?? 'dir';
  const outArg = args.out ?? p.bible.apply?.out;
  if (outArg === undefined) throw new ForgeError('cli.args', '대상 폴더가 없습니다: --out <dir|@이름> 또는 바이블 apply.out');
  const adapter = getAdapter(target);
  const out = resolveOut(cwd, outArg);
  const built = buildCommand(specPath, cwd);
  if (!built.pass) return { ok: true as const, cmd: 'apply', id: p.spec.id, target, pass: false, failed: built.failed, applied: false };
  const files = packFiles(p.spec.id).map((f) => join(cwd, built.out, f));
  const r = adapter.apply({ id: p.spec.id, files }, { out });
  return {
    ok: true as const, cmd: 'apply', id: p.spec.id, target, pass: true, applied: true, cached: built.cached,
    written: r.written, unchanged: r.unchanged, out: outArg.startsWith('@') ? r.dest : relative(cwd, r.dest),
  };
}
