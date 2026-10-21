import { describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { animationSchema, animsFileSchema, rigSchema, rulesSchema } from '@pixel-forge/spec';
import animsJson from '../../../data/rigs/humanoid-34-v1.anims.json' with { type: 'json' };
import rigJson from '../../../data/rigs/humanoid-34-v1.rig.json' with { type: 'json' };
import rulesJson from '../../../data/rules/default.rules.json' with { type: 'json' };
import { isRootFixed, lerpPose } from './pose.js';
import { buildTimeline } from './timeline.js';
import { solveRig } from './transform.js';

const anims = animsFileSchema.parse(animsJson);
const rig = rigSchema.parse(rigJson);
const rules = rulesSchema.parse(rulesJson).anim;

describe('buildTimeline', () => {
  it('inbetween은 지정 키 바로 뒤에만, 개수 그대로', () => {
    const f = buildTimeline(anims.anims.attack!, rules);
    expect(f.map((x) => (x.inbetween ? `~${x.keyName}` : x.keyName))).toEqual(['ready', 'windup', 'strike', '~strike', 'follow', 'recover']);
    expect(f[3]?.ms).toBe(rules.inbetweenMs);
  });

  it('before는 키 바로 앞, ease out 사이 프레임은 이웃 키보다 출발 키 쪽에서 더 멀리 간다', () => {
    const a = animationSchema.parse({
      id: 'x', loop: false,
      keys: [{ name: 'a', ms: 100, pose: { root: { dx: 0 } } }, { name: 'b', ms: 100, pose: { root: { dx: 8 } } }],
      inbetween: [{ before: 'b', count: 1, ease: 'out' }],
    });
    const f = buildTimeline(a, rules);
    expect(f.map((x) => x.keyName)).toEqual(['a', 'b', 'b']);
    expect(f[1]?.inbetween).toBe(true);
    // b에서 a 쪽으로 ease-out 0.75 → dx 2
    expect(f[1]?.pose.root?.dx).toBe(2);
  });

  it('키 사이 균등 보간·개수 초과·긴 타격 키는 ForgeError', () => {
    const base = { id: 'x', loop: false, keys: [{ name: 'a', ms: 100 }, { name: 'b', ms: 100 }] };
    expect(() => buildTimeline(animationSchema.parse({ ...base, inbetween: [{ after: 'a', count: 1, ease: 'linear' }] }), rules)).toThrow(ForgeError);
    expect(() => buildTimeline(animationSchema.parse({ ...base, inbetween: [{ after: 'a', count: 3, ease: 'out' }] }), rules)).toThrow(/inbetween/);
    const slow = animationSchema.parse({ id: 'x', loop: false, keys: [{ name: 'a', ms: 100 }, { name: 'b', ms: 100 }, { name: 'c', ms: 200, fx: 's' }, { name: 'd', ms: 100 }] });
    expect(() => buildTimeline(slow, rules)).toThrow(/타격/);
  });

  it('hold 키는 hold 표시 + defaultKeyMs', () => {
    const f = buildTimeline(anims.anims.death!, rules);
    expect(f[f.length - 1]).toMatchObject({ keyName: 'lie', hold: true, ms: rules.defaultKeyMs });
  });

  it('overrides는 그 키의 같은 뼈만 교체', () => {
    const f = buildTimeline(anims.anims.idle!, rules, { low: { pose: { spine: { dy: 2 } } } });
    expect(f[1]?.pose.spine).toEqual({ dy: 2 });
    expect(f[2]?.pose.spine).toEqual({ dy: 1 });
  });

  it('idle 루프: 마지막 → 첫 프레임 관절 이동량 ≤ 1px', () => {
    const f = buildTimeline(anims.anims.idle!, rules);
    const first = solveRig(rig, 1, f[0]?.pose), last = solveRig(rig, 1, f[f.length - 1]?.pose);
    for (const n of Object.keys(first)) {
      expect(Math.abs((first[n]?.x ?? 0) - (last[n]?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((first[n]?.y ?? 0) - (last[n]?.y ?? 0))).toBeLessThanOrEqual(1);
    }
  });
});

describe('pose', () => {
  it('보간은 정수 스냅, root 고정 판정', () => {
    expect(lerpPose({ a: { rot: 0 } }, { a: { rot: 9 } }, 0.5)).toEqual({ a: { rot: 5 } });
    expect(isRootFixed({ spine: { dy: 1 } }, 'root')).toBe(true);
    expect(isRootFixed({ root: { dx: 2 } }, 'root')).toBe(false);
  });
});
