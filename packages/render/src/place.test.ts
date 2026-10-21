import { describe, expect, it } from 'vitest';
import { solveRig } from '@pixel-forge/rig';
import { placeParts } from './place.js';
import { circle, rig, spec } from './test-fixture.js';

describe('placeParts', () => {
  it('back 층이 먼저, 같은 층은 z → 순번', () => {
    const s = spec([{ ...circle('root'), z: 1 }, circle('root'), circle('back')]);
    const r = rig();
    const p = placeParts(s, r, solveRig(r));
    expect(p.map((x) => x.index)).toEqual([2, 1, 0]);
    expect(p.map((x) => x.depth)).toEqual([1, 2, 3]);
  });

  it('anchor·at은 뼈 로컬 좌표', () => {
    const r = rig();
    const p = placeParts(spec([{ ...circle(), anchor: 'joint', at: [3, -2] }]), r, solveRig(r));
    expect([p[0]?.x, p[0]?.y]).toEqual([3, -2]);
  });
});
