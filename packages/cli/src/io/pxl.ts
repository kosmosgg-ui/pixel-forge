import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';

/** pxl(외부 도구, 저장소 의존성 아님 — Aseprite와 같은 규칙). 고정 커밋(P10 2.1: 신생 포크라 최신을 따라가지 않는다) */
export const PXL_COMMIT = '2e72b9a';
export const PXL_INSTALL = `git clone https://github.com/augusto-scarvalho/claude-pxl.git ~/.claude/skills/pxl-pixel-art && git -C ~/.claude/skills/pxl-pixel-art checkout ${PXL_COMMIT}`;
const MIN_NODE: readonly [number, number] = [22, 18];

/** PXL_BIN(기본 ~/.claude/skills/pxl-pixel-art/bin/pxl.js) + Node 버전 확인. 없거나 낮으면 fx.pxl-missing + 설치 명령 */
export function pxlBin(env: NodeJS.ProcessEnv, nodeVersion: string): string {
  const bin = env['PXL_BIN'] ?? join(homedir(), '.claude', 'skills', 'pxl-pixel-art', 'bin', 'pxl.js');
  if (!existsSync(bin)) throw new ForgeError('fx.pxl-missing', `pxl이 없습니다(${bin}). 설치: ${PXL_INSTALL}`);
  const [maj = 0, min = 0] = nodeVersion.replace(/^v/, '').split('.').map(Number);
  if (maj < MIN_NODE[0] || (maj === MIN_NODE[0] && min < MIN_NODE[1])) throw new ForgeError('fx.pxl-missing', `pxl은 Node ≥ ${MIN_NODE.join('.')}가 필요합니다(지금 ${nodeVersion}). 설치: ${PXL_INSTALL}`);
  return bin;
}

/** 설치된 pxl 커밋(짧은 SHA) — git 저장소가 아니면 'unknown' */
export function pxlCommit(bin: string): string {
  try {
    return execFileSync('git', ['-C', dirname(dirname(bin)), 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** pxl build <src> --out <dir> --no-preview */
export function pxlBuild(bin: string, src: string, out: string): void {
  execFileSync(process.execPath, [bin, 'build', src, '--out', out, '--no-preview'], { stdio: 'pipe' });
}

/** pxl study <png> --no-out → 표준 출력 텍스트(2.4 품질 진단) */
export function pxlStudy(bin: string, png: string): string {
  return execFileSync(process.execPath, [bin, 'study', png, '--no-out'], { encoding: 'utf8' });
}
