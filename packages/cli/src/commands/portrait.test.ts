import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { intakeCommand } from './intake.js';
import { encodePng, decodePng } from '../io/png.js';
it('portrait intake routes approved 2x2 expressions, stages provenance and rejects path escapes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'portrait-cli-'));
  try {
    mkdirSync(join(cwd, 'docs/instructions'), { recursive: true });
    writeFileSync(join(cwd, 'docs/instructions/PROMPTS_GPT_20261023.md'), 'synthetic fixture prompt');
    const rgba = new Uint8Array(200 * 200 * 4);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) rgba.set(x % 100 > 25 && x % 100 < 75 && y % 100 > 10 && y % 100 < 90 ? [160, 80, 40, 255] : [0, 255, 0, 255], (y * 200 + x) * 4);
    writeFileSync(join(cwd, 'sera.png'), encodePng({ w: 200, h: 200, rgba }));
    const result = intakeCommand('sera.png', cwd, { kind: 'portrait', as: 'sera/portrait_set', at: '2026-10-23T00:00:00Z' });
    expect(result).toMatchObject({ count: 4, qa: { pass: true } });
    for (const expression of ['default', 'determined', 'smile', 'surprised']) {
      const dir = join(cwd, 'out/art/candidates/portraits/sera');
      const m = JSON.parse(readFileSync(join(dir, expression + '_manifest.json'), 'utf8')) as { kind: string; provenance: Record<string, unknown>; qa: { headTop: number; green: number } };
      expect(m.kind).toBe('portrait'); expect(Object.keys(m.provenance)).toHaveLength(11);
      expect(m.provenance['aiUsed']).toBe(true); expect(m.qa).toMatchObject({ headTop: 40, green: 0 });
      expect(decodePng(readFileSync(join(dir, expression + '.png')))).toMatchObject({ w: 720, h: 720 });
    }
    expect(() => intakeCommand('../outside.png', cwd, { kind: 'portrait', as: 'sera/default' })).toThrow();
    expect(() => intakeCommand('sera.png', cwd, { kind: 'portrait', as: 'sera/../../escape' })).toThrow();
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
