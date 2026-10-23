import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng } from '../io/png.js';
import { fxImportCommand } from './fx-import.js';
import { slashGeometry } from './fx-geometry.js';
const root = join(import.meta.dirname, '../../../..');
const work = mkdtempSync(join(tmpdir(), 'forge-p11-fx-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
describe.skipIf(!process.env['PXL_BIN'] || !existsSync(process.env['PXL_BIN']!))('P11 real attack specifications', () => {
  it('every approved pair exists with zero QA warnings and measured reach/angle/transparent interior for all 8 directions', () => {
    for (const p of ['data/bibles', 'data/rules', 'data/projects/seonggeom']) cpSync(join(root, p), join(work, p), { recursive: true });
    const result = fxImportCommand(work, { assets: 'data/projects/seonggeom/fx/fx_slashes.json', out: 'out/review' });
    const spec = JSON.parse(readFileSync(join(root, 'data/projects/seonggeom/fx/attack-specs.json'), 'utf8')) as { pairs: { reach: number; angle: number }[] };
    expect(result.count).toBe(spec.pairs.length); expect(result.warnings).toEqual([]);
    for (const p of spec.pairs) {
      const id = `fx_slash_r${p.reach}_a${p.angle}`, dir = join(work, 'out/review', id);
      const m = JSON.parse(readFileSync(join(dir, id + '_manifest.json'), 'utf8')) as { frame_size: [number, number]; anchor: [number, number] };
      const rows = slashGeometry(decodePng(readFileSync(join(dir, id + '_sheet.png'))), m.frame_size, m.anchor, p.reach, p.angle);
      expect(rows).toHaveLength(24); expect(rows.filter((r) => !r.pass)).toEqual([]);
    }
  });
});
