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
    const r = compareCommand('out/sample/mode-compare.png', ['data/specs/sample-frames/goblin-frames.spec.json,data/specs/sample/goblin.spec.json'], work);
    expect(r).toMatchObject({ ok: true, rows: [['goblin-frames', 'goblin']], missingRefs: ['docs/quality-ref/target-grids.json#goblin'], out: 'out/sample/mode-compare.png' });
    expect(() => compareCommand('docs/x.png', ['data/specs/sample/goblin.spec.json'], work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });

  it('시안 그리드가 있으면 엔진으로 렌더해 끝 칸에 넣고 rest와 비교 — 아톰 스켈레톤: 머리 영역 diff 0, 곤봉 차이만큼 IoU < 1', () => {
    cpSync(join(repo, 'docs', 'quality-ref'), join(work, 'docs', 'quality-ref'), { recursive: true });
    const r = compareCommand('out/sample/mode-compare.png', ['data/specs/sample-frames/skeleton-frames.spec.json,data/specs/sample/skeleton.spec.json'], work, 8);
    expect(r).toMatchObject({ missingRefs: [], scale: 8 });
    // 곤봉은 사용자 지시(두께 2·길이 7·끝 혹 3)로 시안보다 커서 실루엣이 다르다 — 곤봉 외 영역은 같다(머리 diff 0)
    expect(r.refs.skeleton?.iou).toBeGreaterThan(0.9);
    expect(r.refs.skeleton?.headDiff).toBe(0);
  });
});
