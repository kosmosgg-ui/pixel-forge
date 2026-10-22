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
    expect(r).toMatchObject({ ok: true, rows: [['goblin-shape', 'goblin']], missingRefs: ['docs/quality-ref/target-grids.json#goblin'], out: 'out/sample/mode-compare.png' });
    expect(() => compareCommand('docs/x.png', ['data/specs/sample/goblin.spec.json'], work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });

  it('시안 그리드가 있으면 엔진으로 렌더해 끝 칸에 넣고 rest와 픽셀 diff(refDiff) — 스켈레톤 rest = 시안', () => {
    cpSync(join(repo, 'docs', 'quality-ref'), join(work, 'docs', 'quality-ref'), { recursive: true });
    const r = compareCommand('out/sample/mode-compare.png', ['data/specs/sample-shape/skeleton-shape.spec.json,data/specs/sample/skeleton.spec.json'], work, 8);
    expect(r).toMatchObject({ refDiff: { skeleton: 0 }, missingRefs: [], scale: 8 });
  });
});
