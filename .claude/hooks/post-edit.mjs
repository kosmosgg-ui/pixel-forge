// PostToolUse(Edit|Write): CLAUDE.md 절대 규칙을 기계적으로 검사하고, 바뀐 파일과 관련된 테스트만 돌린다.
// 통과하면 아무것도 출력하지 않는다(토큰 0). 위반·실패 시 exit 2 + 짧은 stderr → 클로드에게 전달.
import { readFileSync, existsSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const abs = input?.tool_input?.file_path;
if (!abs || !existsSync(abs)) process.exit(0);

const rel = relative(root, abs).split(sep).join('/');
const m = rel.match(/^packages\/([^/]+)\/src\/.+\.ts$/);
if (!m) process.exit(0);

const pkg = m[1];
const isTest = rel.endsWith('.test.ts');
const src = readFileSync(abs, 'utf8');
const problems = [];

// 규칙 1: 결정론 (모든 패키지, 테스트 포함)
if (/\bMath\.random\s*\(/.test(src)) problems.push('Math.random 사용 금지 → core/prng.ts 주입');
if (/\bDate\.now\s*\(|\bnew Date\s*\(/.test(src)) problems.push('시간 API 사용 금지(결정론)');

// 규칙 2: 순수 코어 (cli 외 패키지에서 fs/path/process 금지)
if (pkg !== 'cli' && !isTest) {
  if (/from\s+['"](node:)?(fs|fs\/promises|path|child_process)['"]/.test(src)) problems.push(`${pkg}는 순수 패키지: fs/path import 금지 → cli io 어댑터로`);
  if (/\bprocess\.(env|argv|cwd|exit)\b/.test(src)) problems.push(`${pkg}는 순수 패키지: process 사용 금지`);
}

// 규칙 3: any 금지, 파일 길이
if (/:\s*any\b|<any>|as\s+any\b/.test(src)) problems.push('any 금지 → unknown + 좁히기');
const lineCount = src.split('\n').length;
if (!isTest && lineCount > 250) problems.push(`파일 ${lineCount}줄 > 250 → 모듈 분리`);

if (problems.length) {
  process.stderr.write(`[규칙 위반] ${rel}\n- ${problems.join('\n- ')}\n`);
  process.exit(2);
}

// 관련 테스트만 실행 (출력은 실패 시 꼬리 25줄만)
const run = spawnSync('pnpm', ['exec', 'vitest', 'related', abs, '--run', '--reporter=dot', '--passWithNoTests'], {
  cwd: root, encoding: 'utf8', shell: process.platform === 'win32',
});
if (run.status !== 0) {
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
  process.stderr.write(`[관련 테스트 실패] ${rel}\n${out}\n`);
  process.exit(2);
}
process.exit(0);
