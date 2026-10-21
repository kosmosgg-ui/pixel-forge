import { describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { run, VERSION } from './run.js';

describe('run', () => {
  it('--version은 한 줄 JSON 요약을 돌려준다', () => {
    expect(run({ version: true, positionals: [] })).toEqual({ ok: true, cmd: 'version', version: VERSION });
  });

  it('알 수 없는 명령은 ForgeError', () => {
    expect(() => run({ version: false, positionals: ['nope'] })).toThrow(ForgeError);
  });
});
