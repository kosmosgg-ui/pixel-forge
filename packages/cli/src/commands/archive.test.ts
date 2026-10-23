import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodePng } from '../io/png.js';
import { run } from '../run.js';
import { archiveActor } from './archive.js';
const root = join(import.meta.dirname, '../../../..');
const work = mkdtempSync(join(tmpdir(), 'forge-archive-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
for (const p of ['data/bibles', 'data/rules', 'data/projects/seonggeom']) cpSync(join(root, p), join(work, p), { recursive: true });
function strip() {
  const w = 520, h = 190, rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([0, 255, 0, 255], i * 4);
  for (let i = 0; i < 6; i++) for (let y = 20; y < 160; y++) for (let x = 30 + i * 80; x < 70 + i * 80; x++) rgba.set([60, 80, 120, 255], (y * w + x) * 4);
  mkdirSync(join(work, 'inbox'), { recursive: true });
  writeFileSync(join(work, 'inbox/hero_sera__walk_side.png'), encodePng({ w, h, rgba }));
}
const cli = (positionals: string[], args = {}) => run({ version: false, cwd: work, positionals, ...args });
describe('P11 optional archive/restore', () => {
  it('intake --archive → make → archive snapshot → delete → restore → make is byte-identical', () => {
    strip();
    const received = cli(['intake', 'inbox/hero_sera__walk_side.png'], { archive: 'out/private/art-source', at: '2026-10-23T00:00:00Z' });
    expect(received.archive).toBe('out/private/art-source/hero_sera');
    expect(cli(['make', 'hero_sera'], { action: 'walk', dir: 'side', out: 'out/game' }).pass).toBe(true);
    archiveActor(work, 'hero_sera', 'out/private/art-source');
    const png = readFileSync(join(work, 'out/game/hero_sera/hero_sera_sheet.png'));
    const json = readFileSync(join(work, 'out/game/hero_sera/hero_sera_manifest.json'));
    rmSync(join(work, 'data/import'), { recursive: true }); rmSync(join(work, 'out/make'), { recursive: true });
    expect(cli(['restore', 'hero_sera'], { from: 'out/private/art-source' })).toMatchObject({ ok: true, files: 3 });
    expect(cli(['make', 'hero_sera'], { action: 'walk', dir: 'side', out: 'out/game' }).pass).toBe(true);
    expect(readFileSync(join(work, 'out/game/hero_sera/hero_sera_sheet.png'))).toEqual(png);
    expect(readFileSync(join(work, 'out/game/hero_sera/hero_sera_manifest.json'))).toEqual(json);
  });
  it('hash mismatch and traversal stop before any restore write; JPEG is never registered as original', () => {
    const file = join(work, 'out/private/art-source/hero_sera/state.json'), original = readFileSync(file);
    const index = JSON.parse(original.toString()) as { $archive: { files: { path: string; to: string }[] } };
    const png = index.$archive.files.find((f) => f.path.endsWith('.png'))!;
    const archived = join(work, 'out/private/art-source/hero_sera', png.path), bytes = readFileSync(archived);
    const state = readFileSync(join(work, 'data/import/hero_sera/state.json'));
    writeFileSync(archived, Buffer.from('tampered'));
    expect(() => cli(['restore', 'hero_sera'], { from: 'out/private/art-source' })).toThrow(expect.objectContaining({ code: 'archive.hash' }));
    expect(readFileSync(join(work, 'data/import/hero_sera/state.json'))).toEqual(state); writeFileSync(archived, bytes);
    png.to = 'data/import/hero_sera/../other/state.json';writeFileSync(file, JSON.stringify(index));
    expect(() => cli(['restore', 'hero_sera'], { from: 'out/private/art-source' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    writeFileSync(file, original);
    writeFileSync(join(work, 'inbox/fake.png'), Buffer.from([255, 216, 255]));
    expect(() => cli(['intake', 'inbox/fake.png'], { as: 'hero_sera/walk_side', archive: 'out/private/art-source' })).toThrow(expect.objectContaining({ code: 'intake.format' }));
    expect(() => cli(['restore', '../other'], { from: 'out/private/art-source' })).toThrow();
  });
});
