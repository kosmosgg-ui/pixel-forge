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

  it('재질이 비면 실패한다', () => {
    expect(bibleColorsSchema.safeParse({ ...ok, materials: {} }).success).toBe(false);
  });
});

describe('rulesColorSchema', () => {
  it('materialContrast에서 숫자만 남긴다', () => {
    const r = rulesColorSchema.parse({
      ramp: { id: 'r', steps: 5, deltaL: 0.1, hueShift: 8, warmHue: 70, coolHue: 260, chromaFalloff: 0.25 },
      materialContrast: { id: 'c', source: 's', metal: 1.4, default: 1 },
    });
    expect(r.materialContrast).toEqual({ metal: 1.4, default: 1 });
  });
});
