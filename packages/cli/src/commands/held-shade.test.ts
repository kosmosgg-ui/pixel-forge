import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseHex, srgbToOklab } from '@pixel-forge/core';
import { loadProject } from '../io/project.js';
import { renderProject } from './qa.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));

describe('rule: form.held-thin-shade (샘플)', () => {
  it('도적 단검 날(2px): 모든 프레임에서 게임 배경 대비 평균 명도차 ≥ contrastMinL', () => {
    const p = loadProject('data/specs/sample/rogue.spec.json', repo);
    const r = renderProject(p);
    const bgL = srgbToOklab(...parseHex(p.bible.background)).L;
    const blade = p.spec.parts.findIndex((q) => q.name === 'dagger') + 1;
    const colors = r.palette.palette.colors;
    let worst = Infinity;
    for (const f of [{ raster: r.rest.raster, meta: r.rest.meta }, ...r.frames]) {
      let sum = 0, n = 0;
      f.meta.layers.part.forEach((v, k) => {
        if (v !== blade) return;
        const c = colors[f.raster.px[k] ?? 0] ?? 0;
        sum += srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255).L;
        n++;
      });
      if (n) worst = Math.min(worst, Math.abs(sum / n - bgL));
    }
    expect(worst).toBeGreaterThanOrEqual(p.rules.qa.contrastMinL);
  });
});
