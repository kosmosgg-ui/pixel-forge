import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { resolveInside } from '../io/paths.js';
import type { Adapter, ApplyResult, Artifacts, ApplyOptions } from './types.js';

/** forge가 쓴 파일 기록 — 이 목록에 있고 내용이 그대로인 파일만 다시 덮어쓴다 */
export const LEDGER = '.forge-files.json';

interface Ledger { files: Record<string, string> }

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function readLedger(dest: string): Ledger {
  const path = join(dest, LEDGER);
  if (!existsSync(path)) return { files: {} };
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const files = typeof raw === 'object' && raw !== null && 'files' in raw ? raw.files : undefined;
    if (typeof files === 'object' && files !== null) {
      return { files: Object.fromEntries(Object.entries(files).filter((e): e is [string, string] => typeof e[1] === 'string')) };
    }
  } catch { /* 깨진 기록은 아무것도 forge 것이 아닌 것으로 본다 */ }
  return { files: {} };
}

/** 대상 안의 경로가 심볼릭 링크·폴더 등이면 거부 — 문자열 검사(resolveInside)만으로는 링크를 따라 밖에 쓸 수 있다 */
function assertPlain(path: string, kind: 'dir' | 'file', o: string): void {
  if (!existsSync(path)) return;
  const st = lstatSync(path);
  if (st.isSymbolicLink()) throw new ForgeError('io.path-escape', `대상 안의 심볼릭 링크에는 쓰지 않습니다: ${path}`, { path });
  if (kind === 'dir' ? !st.isDirectory() : !st.isFile()) throw new ForgeError('apply.foreign-file', `일반 ${kind === 'dir' ? '폴더' : '파일'}가 아니어서 덮어쓰지 않습니다: ${path}`, { path });
  const real = realpathSync(path), root = realpathSync(o);
  const rel = relative(root, real);
  if (rel.startsWith('..' + sep) || rel === '..') throw new ForgeError('io.path-escape', `대상 폴더 밖 경로입니다: ${path}`, { path });
}

/** 임시 파일에 쓰고 rename — 중간에 실패해도 반쯤 쓴 파일이 남지 않게 */
function writeAtomic(target: string, data: Buffer | string): void {
  const tmp = `${target}.forge-tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, target);
}

/**
 * 기본 어댑터 dir(엔진 무관): <out>/<id>/에 산출물을 폴더째 복사.
 * 대상 폴더 밖은 쓰지 않고(심볼릭 링크 거부), 같은 이름 파일이 forge가 쓴 것(기록에 있고 내용이 그대로)이 아니면
 * 아무것도 쓰지 않고 실패. 기록에 없어도 내용이 같으면 forge 것으로 받아들인다.
 */
export const dirAdapter: Adapter = {
  id: 'dir',
  apply(a: Artifacts, o: ApplyOptions): ApplyResult {
    const dest = resolveInside(o.out, a.id);
    assertPlain(dest, 'dir', o.out);
    const ledgerPath = join(dest, LEDGER);
    assertPlain(ledgerPath, 'file', o.out);
    const ledger = readLedger(dest);
    const plan = a.files.map((src) => {
      const name = basename(src);
      const target = resolveInside(dest, name);
      assertPlain(target, 'file', o.out);
      const data = readFileSync(src);
      return { name, target, data, hash: sha(data) };
    });
    // 쓰기 전에 전부 확인한다 — 일부만 덮어쓴 채 멈추지 않게
    const foreign = plan.filter((f) => {
      if (!existsSync(f.target)) return false;
      const cur = sha(readFileSync(f.target));
      return ledger.files[f.name] !== cur && cur !== f.hash;
    }).map((f) => f.name);
    if (foreign.length) {
      throw new ForgeError('apply.foreign-file', `forge가 만들지 않았거나 수정된 파일이 있어 덮어쓰지 않습니다: ${foreign.join(', ')}`, { dest, files: foreign });
    }
    mkdirSync(dest, { recursive: true });
    const written: string[] = [], unchanged: string[] = [];
    try {
      for (const f of plan) {
        if (existsSync(f.target) && sha(readFileSync(f.target)) === f.hash) { unchanged.push(f.name); ledger.files[f.name] = f.hash; continue; }
        writeAtomic(f.target, f.data);
        ledger.files[f.name] = f.hash;
        written.push(f.name);
      }
    } finally {
      // 중간에 실패해도 이미 쓴 파일은 forge 것으로 기록해 다음 apply가 막히지 않게
      const sorted = Object.fromEntries(Object.entries(ledger.files).sort(([x], [y]) => x.localeCompare(y)));
      writeAtomic(ledgerPath, JSON.stringify({ files: sorted }, null, 2) + '\n');
    }
    return { written, unchanged, dest };
  },
};
