import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { silhouetteMatch } from '@pixel-forge/import';
import { decodePng } from '../io/png.js';
import { importCommand, probeCommand } from './import.js';

/** 사용자 원본(gitignore) 골든 — 원본이 있는 환경에서만 돈다 */
const root = join(import.meta.dirname, '..', '..', '..', '..');
const SAMPLES = join(root, 'docs/integrated/P8/samples');
const has = existsSync(join(SAMPLES, 'sera_gpt_raw.png')) && existsSync(join(SAMPLES, 'sera_ref_tall_gpt.png'));

describe.skipIf(!has)('import 골든(사용자 원본)', () => {
  it('probe sera_gpt_raw: 스프라이트 30, 줄 3, 고유 21, 잘림 1(#19 오른쪽) — 잘림 정의 P8fix 2', () => {
    expect(probeCommand('docs/integrated/P8/samples/sera_gpt_raw.png', root)).toMatchObject({ sprites: 30, rows: 3, perRow: [10, 10, 10], unique: 21, clipped: 1, clippedAt: { 19: ['right'] } });
  });
  it('재현성: sera_ref_tall 키 64(외곽선 없음) vs 기준 A — 실루엣 IoU ≥ 0.90, ΔE ≤ 0.05 (P8fix 1)', () => {
    importCommand('data/projects/seonggeom/specs/sera-ref-tall-accept.spec.json', root);
    const m = silhouetteMatch(
      decodePng(readFileSync(join(root, 'docs/integrated/P7close/calibration-v2/A_gpt-import-sera.png'))),
      decodePng(readFileSync(join(root, 'out/sera-ref-tall-accept/frames/idle_s_0.png'))),
    );
    expect(m.iou).toBeGreaterThanOrEqual(0.9);
    expect(m.deltaE).toBeLessThanOrEqual(0.05);
  });
});
