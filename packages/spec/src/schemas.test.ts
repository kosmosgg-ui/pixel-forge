import { describe, expect, it } from 'vitest';
import bibleJson from '../../../data/bibles/sample-v0.bible.json' with { type: 'json' };
import rigJson from '../../../data/rigs/humanoid-side-v1.rig.json' with { type: 'json' };
import rulesJson from '../../../data/rules/default.rules.json' with { type: 'json' };
import rogueJson from '../../../data/specs/sample/rogue.spec.json' with { type: 'json' };
import { bibleSchema } from './bible-schema.js';
import { checkRefs } from './refs.js';
import { rigSchema } from './rig-schema.js';
import { rulesSchema } from './rules-schema.js';
import { specSchema } from './spec-schema.js';

describe('data 파일이 스키마를 통과한다', () => {
  it('sample-v0, humanoid-side-v1, default rules, rogue', () => {
    expect(bibleSchema.safeParse(bibleJson).success).toBe(true);
    expect(rigSchema.safeParse(rigJson).success).toBe(true);
    expect(rulesSchema.safeParse(rulesJson).success).toBe(true);
    expect(specSchema.safeParse(rogueJson).success).toBe(true);
  });
});

describe('bibleSchema', () => {
  it('colorBudget 키가 sizeClasses와 다르면 실패', () => {
    expect(bibleSchema.safeParse({ ...bibleJson, colorBudget: { character: 15 } }).success).toBe(false);
  });

  it('roleColorKey는 있는 재질만', () => {
    expect(bibleSchema.safeParse({ ...bibleJson, roleColorKey: { bard: 'velvet' } }).success).toBe(false);
  });
});

describe('rigSchema', () => {
  it('drawOrder 누락·부모 없음·순환은 실패', () => {
    expect(rigSchema.safeParse({ ...rigJson, drawOrder: rigJson.drawOrder.slice(1) }).success).toBe(false);
    const orphan = { ...rigJson, bones: { ...rigJson.bones, head: { ...rigJson.bones.head, parent: 'nope' } } };
    expect(rigSchema.safeParse(orphan).success).toBe(false);
    const loop = { ...rigJson, bones: { ...rigJson.bones, spine: { ...rigJson.bones.spine, parent: 'head' } } };
    expect(rigSchema.safeParse(loop).success).toBe(false);
  });
});

describe('specSchema', () => {
  it('기본값: z 0, anchor mid, at [0,0], orient bone', () => {
    const s = specSchema.parse(rogueJson);
    expect(s.parts[0]).toMatchObject({ z: 0, anchor: 'mid', at: [0, 0], orient: 'bone' });
  });

  it('mask가 아닌 파츠는 material 필수, mask 행은 legend 문자만', () => {
    const base = { ...rogueJson, parts: [{ bone: 'head', shape: { type: 'ellipse', w: 3, h: 3 } }] };
    expect(specSchema.safeParse(base).success).toBe(false);
    const mask = { bone: 'head', shape: { type: 'mask', origin: [0, 0], rows: ['ab'], legend: { a: { material: 'skin' } } } };
    expect(specSchema.safeParse({ ...rogueJson, parts: [mask] }).success).toBe(false);
  });

  it('kind는 정해진 다섯 가지만', () => {
    expect(specSchema.safeParse({ ...rogueJson, kind: 'vehicle' }).success).toBe(false);
  });
});

describe('checkRefs', () => {
  it('통과하면 빈 목록, 없는 뼈·재질·sizeClass는 오류', () => {
    const bible = bibleSchema.parse(bibleJson), rig = rigSchema.parse(rigJson), spec = specSchema.parse(rogueJson);
    expect(checkRefs(spec, bible, rig)).toEqual([]);
    const bad = specSchema.parse({ ...rogueJson, sizeClass: 'giant', parts: [{ bone: 'tail', shape: { type: 'ellipse', w: 3, h: 3 }, material: 'velvet' }] });
    expect(checkRefs(bad, bible, rig)).toHaveLength(3);
  });
});
