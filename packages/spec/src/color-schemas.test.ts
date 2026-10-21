import { describe, expect, it } from 'vitest';
import { bibleColorsSchema, rulesColorSchema } from './color-schemas.js';

describe('bibleColorsSchema', () => {
  const ok = { id: 'b', materials: { skin: { base: '#d9a07a', steps: 4, kind: 'skin' } }, outline: { globalColor: '#1a1020' }, fxColors: [] };

  it('필요한 필드가 있으면 통과하고 다른 필드는 보존한다', () => {
    const r = bibleColorsSchema.parse({ ...ok, view: 'side' });
    expect(r.view).toBe('side');
  });

  it('hex 형식이 틀리면 실패한다', () => {
    expect(bibleColorsSchema.safeParse({ ...ok, fxColors: ['fff'] }).success).toBe(false);
  });

  it('shareWith는 있는 다른 재질만', () => {
    const two = { skin: { base: '#d9a07a', steps: 4, kind: 'skin' }, tan: { base: '#d9a07a', steps: 3, kind: 'skin', shareWith: 'skin' } };
    expect(bibleColorsSchema.safeParse({ ...ok, materials: two }).success).toBe(true);
    expect(bibleColorsSchema.safeParse({ ...ok, materials: { ...two, tan: { ...two.tan, shareWith: 'nope' } } }).success).toBe(false);
  });

  it('재질이 비면 실패한다', () => {
    expect(bibleColorsSchema.safeParse({ ...ok, materials: {} }).success).toBe(false);
  });
});

describe('rulesColorSchema', () => {
  it('materialContrast에서 숫자만 남긴다', () => {
    const r = rulesColorSchema.parse({
      ramp: { id: 'r', steps: 5, deltaL: 0.1, hueShift: 8, warmHue: 70, coolHue: 260, chromaFalloff: 0.25, minL: 0.18, maxL: 0.93, avoidHueBand: [115, 165], reservedMinDistance: 0.03, collisionNudgeL: 0.02, collisionMaxNudges: 5, outlineToneDeltaL: 0.08, outlineToneChroma: 0.6 },
      materialContrast: { id: 'c', source: 's', metal: 1.4, default: 1 },
    });
    expect(r.materialContrast).toEqual({ metal: 1.4, default: 1 });
  });
});
