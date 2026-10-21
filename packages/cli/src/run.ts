import { ForgeError } from '@pixel-forge/core';

export const VERSION = '0.0.0';

export interface RunInput {
  version: boolean;
  positionals: string[];
}

export type RunResult = { ok: true; cmd: string } & Record<string, unknown>;

export function run(input: RunInput): RunResult {
  if (input.version || input.positionals[0] === 'version') {
    return { ok: true, cmd: 'version', version: VERSION };
  }
  const cmd = input.positionals[0];
  if (cmd === undefined) throw new ForgeError('cli.no-command', '명령이 없습니다. 예: forge --version');
  throw new ForgeError('cli.unknown-command', `알 수 없는 명령: ${cmd}`);
}
