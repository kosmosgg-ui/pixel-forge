import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { compareCommand } from './compare.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-compare-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('forge compare', () => {
  it('줄마다 Spec 묶음 + 시안 칸, 시안이 없으면 missingRefs, out/ 밖은 io.path-escape', () => {
    const r = compareCommand('out/sample/mode-compare.png', ['data/specs/sample-shape/goblin-shape.spec.json,data/specs/sample/goblin.spec.json'], work);
    expect(r).toMatchObject({ ok: true, rows: [['goblin-shape', 'goblin']], missingRefs: ['docs/quality-ref/goblin.png'], out: 'out/sample/mode-compare.png' });
    expect(() => compareCommand('docs/x.png', ['data/specs/sample/goblin.spec.json'], work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });
});
