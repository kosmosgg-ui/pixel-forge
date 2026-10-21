import { describe, expect, it } from 'vitest';
import { FORGE_VERSION, ForgeError } from '@pixel-forge/core';
import { run } from './run.js';

describe('run', () => {
  it('--version은 한 줄 JSON 요약을 돌려준다', () => {
    expect(run({ version: true, positionals: [], cwd: '.' })).toEqual({ ok: true, cmd: 'version', version: FORGE_VERSION });
  });

  it('알 수 없는 명령은 ForgeError', () => {
    expect(() => run({ version: false, positionals: ['nope'], cwd: '.' })).toThrow(ForgeError);
  });
});
