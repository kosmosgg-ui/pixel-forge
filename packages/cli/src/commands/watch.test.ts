import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { affectedSpecs, watchCommand, watchIndex } from './watch.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-watch-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('forge watch', () => {
  it('Spec 변경 → 그 캐릭터만, 공용 애니·바이블·규칙 변경 → 쓰는 캐릭터 전부', () => {
    const index = watchIndex('sample', work);
    const all = index.length;
    expect(affectedSpecs(join(work, 'data/specs/sample/rogue.spec.json'), index)).toEqual(['data/specs/sample/rogue.spec.json']);
    expect(affectedSpecs(join(work, 'data/rigs/humanoid-34-v1.anims.json'), index)).toHaveLength(all);
    expect(affectedSpecs(join(work, 'data/bibles/sample-v0.bible.json'), index)).toHaveLength(all);
    expect(affectedSpecs(join(work, 'data/rules/default.rules.json'), index)).toHaveLength(all);
    expect(affectedSpecs(join(work, 'README.md'), index)).toEqual([]);
  });

  it('Spec을 저장하면 해당 캐릭터만 build → apply (한 줄 JSON)', async () => {
    const lines: Record<string, unknown>[] = [];
    const w = watchCommand('sample', work, { target: 'dir', out: 'game' }, (l) => lines.push(l));
    expect(w.result).toMatchObject({ ok: true, cmd: 'watch', specs: expect.arrayContaining(['data/specs/sample/rogue.spec.json']) });
    try {
      // chokidar가 감시를 시작할 시간을 준다
      await new Promise((r) => setTimeout(r, 400));
      const path = join(work, 'data/specs/sample/rogue.spec.json');
      writeFileSync(path, readFileSync(path, 'utf8').replace(/\n$/, '\n\n'));
      for (let i = 0; i < 100 && !lines.length; i++) await new Promise((r) => setTimeout(r, 100));
    } finally {
      await w.close();
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ ok: true, cmd: 'apply', id: 'rogue', applied: true });
    expect(existsSync(join(work, 'game', 'rogue', 'rogue.json'))).toBe(true);
    expect(existsSync(join(work, 'game', 'warrior'))).toBe(false);
  }, 30000);
});
