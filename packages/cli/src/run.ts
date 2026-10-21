import { FORGE_VERSION, ForgeError } from '@pixel-forge/core';
import { buildAllCommand, buildCommand } from './commands/build.js';
import { crowdCommand } from './commands/crowd.js';
import { paletteCommand } from './commands/palette.js';
import { qaCommand } from './commands/qa.js';
import { renderCommand } from './commands/render.js';
import { reviewCommand } from './commands/review.js';
import { validateCommand } from './commands/validate.js';

export interface RunInput {
  version: boolean;
  positionals: string[];
  cwd: string;
  /** --anim a,b */
  anim?: string;
  /** --count n */
  count?: string;
  /** --seed n */
  seed?: string;
}

function intOption(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new ForgeError('cli.args', `--${name}는 0 이상의 정수여야 합니다: ${raw}`);
  return n;
}

export type RunResult = { ok: true; cmd: string } & Record<string, unknown>;

export function run(input: RunInput): RunResult {
  if (input.version || input.positionals[0] === 'version') {
    return { ok: true, cmd: 'version', version: FORGE_VERSION };
  }
  const [cmd, arg] = input.positionals;
  if (cmd === undefined) throw new ForgeError('cli.no-command', '명령이 없습니다. 예: forge --version');
  const need = (usage: string): string => {
    if (arg === undefined) throw new ForgeError('cli.args', `사용법: forge ${cmd} ${usage}`);
    return arg;
  };
  if (cmd === 'palette') return paletteCommand(need('<bible id 또는 경로>'), input.cwd);
  if (cmd === 'validate') return validateCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'render') return renderCommand(need('<spec 경로> [--anim a,b]'), input.cwd, input.anim ? input.anim.split(',').filter(Boolean) : []);
  if (cmd === 'crowd') return crowdCommand(need('<프로젝트 이름> [--count 50] [--seed 1]'), input.cwd, intOption('count', input.count, 50), intOption('seed', input.seed, 1));
  if (cmd === 'review') return reviewCommand(need('<프로젝트 이름>'), input.cwd);
  if (cmd === 'qa') return qaCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'build') return buildCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'build-all') return buildAllCommand(need('<프로젝트 이름>'), input.cwd);
  throw new ForgeError('cli.unknown-command', `알 수 없는 명령: ${cmd}`);
}
