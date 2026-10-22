// Codex 등 훅이 없는 에이전트용: .claude/hooks/post-edit.mjs와 같은 규칙을 git으로 바뀐 파일에 적용한다.
// 전제: pnpm install && pnpm build 1회(워크스페이스 패키지 링크). 사용: node scripts/check-rules.mjs [기준 커밋, 기본 HEAD]   통과 시 출력 없음, 위반·실패 시 exit 2.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base = process.argv[2] ?? 'HEAD';
const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
const files = [...new Set([...git(['diff', '--name-only', base]), ...git(['ls-files', '--others', '--exclude-standard'])])]
  .filter((f) => /^packages\/[^/]+\/src\/.+\.ts$/.test(f) && existsSync(f));
let failed = false;
for (const rel of files) {
  const pkg = rel.split('/')[1];
  const isTest = rel.endsWith('.test.ts');
  const src = readFileSync(rel, 'utf8');
  const p = [];
  if (/\bMath\.random\s*\(/.test(src)) p.push('Math.random 금지 → core/prng.ts');
  if (/\bDate\.now\s*\(|\bnew Date\s*\(/.test(src)) p.push('시간 API 금지(결정론)');
  if (!['cli', 'gen'].includes(pkg) && !isTest) {
    if (/from\s+['"](node:)?(fs|fs\/promises|path|child_process)['"]/.test(src)) p.push(`${pkg} 순수 패키지: fs/path import 금지`);
    if (/\bprocess\.(env|argv|cwd|exit)\b/.test(src)) p.push(`${pkg} 순수 패키지: process 금지`);
  }
  if (/:\s*any\b|<any>|as\s+any\b/.test(src)) p.push('any 금지');
  const n = src.split('\n').length;
  if (!isTest && n > 250) p.push(`파일 ${n}줄 > 250`);
  if (p.length) { failed = true; process.stderr.write(`[규칙 위반] ${rel}\n- ${p.join('\n- ')}\n`); }
}
if (failed) process.exit(2);
if (files.length) {
  const run = spawnSync('pnpm', ['exec', 'vitest', 'related', ...files, '--run', '--reporter=dot', '--passWithNoTests'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (run.status !== 0) {
    process.stderr.write(`[관련 테스트 실패]\n${`${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n')}\n`);
    process.exit(2);
  }
}
