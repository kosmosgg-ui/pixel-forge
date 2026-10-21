import { FORGE_VERSION, ForgeError } from '@pixel-forge/core';
import { buildAllCommand, buildCommand } from './commands/build.js';
import { paletteCommand } from './commands/palette.js';
import { qaCommand } from './commands/qa.js';
import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';

export interface RunInput {
  version: boolean;
  positionals: string[];
  cwd: string;
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
  if (cmd === 'render') return renderCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'qa') return qaCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'build') return buildCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'build-all') return buildAllCommand(need('<프로젝트 이름>'), input.cwd);
  throw new ForgeError('cli.unknown-command', `알 수 없는 명령: ${cmd}`);
}
