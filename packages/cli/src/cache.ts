import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FORGE_VERSION } from '@pixel-forge/core';

const MANIFEST = 'cache.json';

/** §11 캐시 키 = SHA-256(spec + bible + rig + anims + rules 파일 바이트 + 엔진 버전). 파일 순서는 호출자가 고정한다 */
export function cacheKey(files: readonly string[]): string {
  const h = createHash('sha256');
  for (const f of files) {
    const data = existsSync(f) ? readFileSync(f) : Buffer.alloc(0);
    h.update(`${data.length}:`).update(data);
  }
  return h.update(`forge@${FORGE_VERSION}`).digest('hex');
}

export const cacheDir = (cwd: string, key: string): string => join(cwd, '.forge-cache', key);

/** 캐시에 있으면 outDir로 복사하고 true */
export function restoreCache(cwd: string, key: string, outDir: string): boolean {
  const dir = cacheDir(cwd, key);
  const manifest = join(dir, MANIFEST);
  if (!existsSync(manifest)) return false;
  const files = JSON.parse(readFileSync(manifest, 'utf8')) as unknown;
  if (!Array.isArray(files)) return false;
  for (const rel of files) {
    if (typeof rel !== 'string') return false;
    mkdirSync(dirname(join(outDir, rel)), { recursive: true });
    cpSync(join(dir, rel), join(outDir, rel));
  }
  return true;
}

/** 폴더 안 모든 파일의 상대 경로(정렬, '/' 구분) */
export function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
    .sort();
}

/** outDir 안 files(상대 경로, 생략하면 폴더 전체)를 캐시에 저장 */
export function storeCache(cwd: string, key: string, outDir: string, files: readonly string[] = listFiles(outDir)): void {
  const dir = cacheDir(cwd, key);
  rmSync(dir, { recursive: true, force: true });
  for (const rel of files) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    cpSync(join(outDir, rel), join(dir, rel));
  }
  writeFileSync(join(dir, MANIFEST), JSON.stringify([...files]));
}
