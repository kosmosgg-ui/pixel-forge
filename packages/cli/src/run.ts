import { FORGE_VERSION, ForgeError } from '@pixel-forge/core';
import { paletteCommand } from './commands/palette.js';

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
  if (cmd === 'palette') {
    if (arg === undefined) throw new ForgeError('cli.args', '사용법: forge palette <bible id 또는 경로>');
    return paletteCommand(arg, input.cwd);
  }
  throw new ForgeError('cli.unknown-command', `알 수 없는 명령: ${cmd}`);
}
