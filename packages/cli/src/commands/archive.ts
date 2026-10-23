import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import { resolveInside } from '../io/paths.js';
import { writeFileEnsured } from '../io/files.js';
import { readState } from '../prompts/state.js';

const idSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const archiveSchema = z.object({
  items: z.record(z.string(), z.unknown()),
  $archive: z.object({ version: z.literal(1), stateSha256: z.string().length(64), files: z.array(z.object({ path: z.string(), to: z.string(), sha256: z.string().length(64) })) }),
});
function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap((e) => e.isDirectory() ? filesUnder(join(root, e.name)) : e.isFile() ? [join(root, e.name)] : []);
}
/** Existing ignored out/ can host a separate art-source worktree; archive is opt-in. */
export function archiveActor(cwd: string, actor: string, directory: string) {
  idSchema.parse(actor);
  const dest = resolveInside(cwd, join(directory, actor));
  const input = join(cwd, 'data/import', actor), specs = join(cwd, 'out/make', actor);
  if (dest === input || dest.startsWith(input + '/')) throw new ForgeError('io.path-escape', 'archive는 입력 폴더 밖에 두세요');
  const state = readState(cwd, actor);
  const usedSpecs = new Set(Object.entries(state.items).map(([key, value]) => `${value.spec ?? key}.spec.json`));
  const sources = filesUnder(input).filter((p) => !relative(input, p).startsWith('baseline/') && /\.(png|intake\.json)$/.test(p))
    .map((p) => ({ source: p, path: relative(input, p).replace(/^references\/([^/]+)\//, 'refs/$1__') }))
    .concat(filesUnder(specs).filter((p) => usedSpecs.has(relative(specs, p))).map((p) => ({ source: p, path: 'specs/' + relative(specs, p) })));
  const files = sources.map(({ source, path }) => {
    const bytes = readFileSync(source);
    if (source.endsWith('.png')) {
      const meta = JSON.parse(readFileSync(source.replace(/\.png$/, '.intake.json'), 'utf8')) as { sha256?: string };
      if (meta.sha256 !== sha(bytes)) throw new ForgeError('archive.hash', `원본 해시 불일치: ${relative(cwd, source)}`);
    }
    return { source, path, to: relative(cwd, source), bytes, sha256: sha(bytes) };
  });
  const index = { ...state, $archive: { version: 1, stateSha256: sha(JSON.stringify(state)), files: files.map(({ path, to, sha256 }) => ({ path, to, sha256 })) } };
  for (const f of files) writeFileEnsured(resolveInside(dest, f.path), f.bytes);
  writeFileEnsured(join(dest, 'state.json'), Buffer.from(JSON.stringify(index, null, 2) + '\n'));
  return { archive: relative(cwd, dest), files: files.length };
}
/** Validate every hash and destination before restoring any byte. */
export function restoreCommand(actor: string, cwd: string, directory: string) {
  idSchema.parse(actor);
  const root = resolveInside(cwd, join(directory, actor));
  const index = archiveSchema.parse(JSON.parse(readFileSync(join(root, 'state.json'), 'utf8')));
  const state = { items: index.items };
  if (sha(JSON.stringify(state)) !== index.$archive.stateSha256) throw new ForgeError('archive.hash', '상태 해시 불일치');
  const files = index.$archive.files.map((f) => {
    if (!f.to.startsWith(`data/import/${actor}/`) && !f.to.startsWith(`out/make/${actor}/`)) throw new ForgeError('io.path-escape', f.to);
    const prefix = f.to.startsWith(`data/import/${actor}/`) ? `data/import/${actor}/` : `out/make/${actor}/`;
    const to = resolveInside(join(cwd, prefix), f.to.slice(prefix.length)), bytes = readFileSync(resolveInside(root, f.path));
    if (sha(bytes) !== f.sha256) throw new ForgeError('archive.hash', `보관 해시 불일치: ${f.path}`);
    return { to, bytes };
  });
  for (const f of files) writeFileEnsured(f.to, f.bytes);
  writeFileEnsured(join(cwd, 'data/import', actor, 'state.json'), Buffer.from(JSON.stringify(state, null, 2) + '\n'));
  return { ok: true as const, cmd: 'restore', actor, files: files.length };
}
