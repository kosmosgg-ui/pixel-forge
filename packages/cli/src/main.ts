#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { EXIT_INTERNAL, EXIT_OK, EXIT_VALIDATION, ForgeError } from '@pixel-forge/core';
import { run } from './run.js';

try {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { version: { type: 'boolean' }, pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: true,
  });
  const result = run({ version: values.version === true, positionals, cwd: process.cwd() });
  process.stdout.write(JSON.stringify(result, null, values.pretty === true ? 2 : undefined) + '\n');
  process.exitCode = EXIT_OK;
} catch (err) {
  const isForge = err instanceof ForgeError;
  // parseArgs의 알 수 없는 옵션 오류도 입력 검증 실패로 취급
  const isArg = err instanceof TypeError && 'code' in err && String(err.code).startsWith('ERR_PARSE_ARGS');
  const code = isForge ? err.code : isArg ? 'cli.args' : 'internal';
  const message = err instanceof Error ? err.message : String(err);
  const detail = isForge && err.detail !== undefined ? { detail: err.detail } : {};
  process.stdout.write(JSON.stringify({ ok: false, error: { code, message, ...detail } }) + '\n');
  process.exitCode = isForge || isArg ? EXIT_VALIDATION : EXIT_INTERNAL;
}
