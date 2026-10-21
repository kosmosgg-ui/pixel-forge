#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { EXIT_INTERNAL, EXIT_OK, EXIT_QA_FAILED, EXIT_VALIDATION, ForgeError } from '@pixel-forge/core';
import { run } from './run.js';

try {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      version: { type: 'boolean' }, pretty: { type: 'boolean' },
      anim: { type: 'string' }, count: { type: 'string' }, seed: { type: 'string' },
      format: { type: 'string' }, target: { type: 'string' }, out: { type: 'string' },
      source: { type: 'string' }, license: { type: 'string' }, id: { type: 'string' },
      score: { type: 'string' }, note: { type: 'string' }, 'skip-review': { type: 'boolean' }, sheet: { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
  const result = run({
    version: values.version === true, positionals, cwd: process.cwd(),
    ...(values.anim !== undefined ? { anim: values.anim } : {}),
    ...(values.count !== undefined ? { count: values.count } : {}),
    ...(values.seed !== undefined ? { seed: values.seed } : {}),
    ...(values.format !== undefined ? { format: values.format } : {}),
    ...(values.target !== undefined ? { target: values.target } : {}),
    ...(values.out !== undefined ? { out: values.out } : {}),
    ...(values.source !== undefined ? { source: values.source } : {}),
    ...(values.license !== undefined ? { license: values.license } : {}),
    ...(values.id !== undefined ? { id: values.id } : {}),
    ...(values.score !== undefined ? { score: values.score } : {}),
    ...(values.note !== undefined ? { note: values.note } : {}),
    ...(values['skip-review'] === true ? { skipReview: true } : {}),
    ...(values.sheet !== undefined ? { sheet: values.sheet } : {}),
  });
  process.stdout.write(JSON.stringify(result, null, values.pretty === true ? 2 : undefined) + '\n');
  // QA 불합격은 명령 자체는 성공(ok)이지만 종료 코드 2
  process.exitCode = result.pass === false ? EXIT_QA_FAILED : EXIT_OK;
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
