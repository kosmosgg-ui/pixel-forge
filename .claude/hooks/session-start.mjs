// SessionStart: 현재 단계와 최근 진행 로그를 컨텍스트에 바로 넣어 progress.md 전체 Read를 생략하게 한다.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = join(root, 'docs', 'progress.md');
if (!existsSync(file)) process.exit(0);

const lines = readFileSync(file, 'utf8').split('\n');
const phase = lines.find((l) => l.startsWith('현재 단계')) ?? '현재 단계: (미기재)';
const logStart = lines.findIndex((l) => l.startsWith('## 로그'));
const recent = logStart >= 0 ? lines.slice(logStart + 1).filter((l) => l.trim()).slice(0, 6).map((l) => (l.length > 160 ? l.slice(0, 157) + '…' : l)) : [];

process.stdout.write(
  [
    '[pixel-forge 세션 컨텍스트]',
    phase,
    '최근 로그:',
    ...recent,
    '→ 이 내용으로 progress.md 확인을 대신한다. 해당 docs/phases/P{n}.md 하나만 읽고 시작.',
  ].join('\n') + '\n',
);
