import { describe, expect, it } from 'vitest';
import animsJson from '../../../data/rigs/humanoid-34-v1.anims.json' with { type: 'json' };
import { animsFileSchema, motionSchema, resolveMotion } from './anim-schema.js';

describe('motion', () => {
  const base = motionSchema.parse({ bob: { px: 1, ms: 400 }, squash: { x: 1.1, y: 0.9, ms: 80 }, hitFlash: { ms: 60 } });

  it('Spec 값이 키 단위로 바이블 기본값을 덮어쓴다', () => {
    expect(resolveMotion(base, { bob: { ms: 300 }, hitFlash: { ms: 40 } })).toEqual({
      bob: { px: 1, ms: 300 }, squash: { x: 1.1, y: 0.9, ms: 80 }, hitFlash: { ms: 40 },
    });
  });

  it('덮어쓰기가 없으면 기본값 그대로', () => {
    expect(resolveMotion(base)).toEqual(base);
  });
});

describe('animsFileSchema', () => {
  it('humanoid-34-v1.anims.json 통과', () => {
    expect(animsFileSchema.safeParse(animsJson).success).toBe(true);
  });

  it('없는 fx·없는 키를 가리키는 inbetween·after/before 동시 지정은 실패', () => {
    const base = { rig: 'r', anims: { a: { id: 'a', loop: false, keys: [{ name: 'k', ms: 100 }] } } };
    const bad = (anim: object) => animsFileSchema.safeParse({ ...base, anims: { a: { ...base.anims.a, ...anim } } }).success;
    expect(bad({ keys: [{ name: 'k', ms: 100, fx: 'nope' }] })).toBe(false);
    expect(bad({ inbetween: [{ after: 'zz', count: 1, ease: 'out' }] })).toBe(false);
    expect(bad({ inbetween: [{ after: 'k', before: 'k', count: 1, ease: 'out' }] })).toBe(false);
  });
});
