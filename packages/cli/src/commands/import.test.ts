import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodePng } from '../io/png.js';
import { importCommand, probeCommand } from './import.js';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const work = mkdtempSync(join(tmpdir(), 'forge-import-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
for (const d of ['data/bibles', 'data/rules', 'data/projects/seonggeom']) cpSync(join(root, d), join(work, d), { recursive: true });

/** 흰 배경 시트: 2줄 × 3칸(32px), 몸(빨강·외곽 검정) + 가운데 흰 천 — 1줄은 천 길이가 칸마다 다르고, 2줄 1·3번은 같은 그림 */
function sheet(): void {
  const w = 96, h = 64, rgba = new Uint8Array(w * h * 4).fill(255);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: number[]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rgba.set(c, (y * w + x) * 4); };
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = c * 32 + 8 + (r === 0 ? c : 0), y = r * 32 + 4;
    rect(x, y, x + 13, y + 23, [20, 20, 30, 255]);
    rect(x + 1, y + 1, x + 12, y + 22, [200, 40, 40, 255]);
    rect(x + 4, y + 6, x + 9, y + 12 + (r === 0 ? c : c === 1 ? 2 : 0), [252, 252, 252, 255]);
  }
  mkdirSync(join(work, 'data/import'), { recursive: true });
  writeFileSync(join(work, 'data/import/t.png'), encodePng({ w, h, rgba }));
}
sheet();
const spec = {
  id: 'imp-t', kind: 'character', bible: 'sample-v0', sizeClass: 'character', mode: 'import',
  source: { path: 'data/import/t.png', origin: 'test-synthetic' },
  layout: { rows: [{ anim: 'idle', dir: 's', fps: 4 }, { anim: 'run', dir: 'e' }] },
  cell: { w: 32, h: 32, anchor: [16, 30] }, palette: { max: 8 },
};
writeFileSync(join(work, 'imp.spec.json'), JSON.stringify(spec));

describe('forge import', () => {
  it('Spec → frames·sheet·qa·Aseprite·manifest(입력 sha256·aiGenerated·frameMap), 두 번 → 바이트 동일', () => {
    const r = importCommand('imp.spec.json', work);
    expect(r).toMatchObject({ ok: true, id: 'imp-t', frames: 5, out: 'out/imp-t' });
    const m = JSON.parse(readFileSync(join(work, 'out/imp-t/manifest.json'), 'utf8'));
    expect(m).toMatchObject({ aiGenerated: true, frameMap: { idle_s: [0, 1, 2], run_e: [0, 1, 0] }, source: { origin: 'test-synthetic', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }, anchor: [16, 30] });
    const qa = JSON.parse(readFileSync(join(work, 'out/imp-t/qa.json'), 'utf8'));
    expect(qa.checks.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining(['import.palette-delta', 'import.jitter', 'import.identity']));
    const files = ['imp-t.png', 'imp-t.json', 'manifest.json', 'sheet.png', 'frames/run_e_1.png'].map((f) => readFileSync(join(work, 'out/imp-t', f)));
    importCommand('imp.spec.json', work);
    files.forEach((b, i) => expect(readFileSync(join(work, 'out/imp-t', ['imp-t.png', 'imp-t.json', 'manifest.json', 'sheet.png', 'frames/run_e_1.png'][i] ?? '')).equals(b)).toBe(true));
  });
  it('--target godot-rowsheet: 프로젝트 바이블(data/projects) + target.json → <out>/<target.dir>/<id>/, quality candidate·aiUsed·rightsReviewed false', () => {
    writeFileSync(join(work, 'g.spec.json'), JSON.stringify({ ...spec, id: 'imp-g', bible: 'seonggeom', sizeClass: 'hero', targetHeight: 24, layout: { rows: [{ anim: 'idle', dir: 's' }, { anim: 'run', dir: 'e' }] } }));
    const r = importCommand('g.spec.json', work, { target: 'godot-rowsheet', out: 'game' });
    expect(r.exported).toMatchObject({ columns: 6, rows: ['front', 'right_side'], dest: 'game/imp-g' });
    const m = JSON.parse(readFileSync(join(work, 'game/imp-g/imp-g_manifest.json'), 'utf8'));
    expect(m).toMatchObject({ quality: 'candidate', frame_size: [32, 32], sheet_size: [192, 64], directions: { left: { row: 1, flip_h: true } }, provenance: { assetId: 'imp-g', aiUsed: true, rightsReviewed: false, exportFile: 'imp-g_sheet.png' } });
    expect(m.directions).not.toHaveProperty('up');
    expect(() => importCommand('g.spec.json', work, { target: 'godot-rowsheet', out: '@seonggeom' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    expect(() => importCommand('g.spec.json', work, { target: 'godot-rowsheet', out: '../x' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });
  it('--probe: 스프라이트·줄·고유 프레임 요약 + 표 파일, 작업 폴더 밖 경로는 io.path-escape', () => {
    expect(probeCommand('data/import/t.png', work)).toMatchObject({ sprites: 6, rows: 2, perRow: [3, 3], clipped: 0, unique: 5, out: 'out/probe/t.md' });
    writeFileSync(join(work, 'esc.spec.json'), JSON.stringify({ ...spec, bible: '../../x' }));
    expect(() => importCommand('esc.spec.json', work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    expect(() => probeCommand('../x.png', work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });
});
