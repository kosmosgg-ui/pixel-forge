import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '../io/png.js';
import { intakeCommand } from './intake.js';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const work = mkdtempSync(join(tmpdir(), 'forge-cutin-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
for (const d of ['data/bibles', 'data/rules', 'data/projects/seonggeom']) cpSync(join(root, d), join(work, d), { recursive: true });
mkdirSync(join(work, 'inbox'), { recursive: true });

describe('forge intake --kind cutin(P10 3절, 합성 입력)', () => {
  it('초록 배경 제거 + 가로 1280 이하 축소(도트 변환 없음) → candidates cutin_<actor>/cutin.png + 매니페스트 kind cutin·aiUsed true', () => {
    const W = 1600, H = 600, rgba = new Uint8Array(W * H * 4);
    for (let k = 0; k < W * H; k++) rgba.set([0, 255, 0, 255], k * 4);
    for (let y = 100; y < 500; y++) for (let x = 200; x < 900; x++) rgba.set([200, 60, 60, 255], (y * W + x) * 4);
    writeFileSync(join(work, 'inbox/hero_sera__cutin.png'), encodePng({ w: W, h: H, rgba }));
    const r = intakeCommand('inbox/hero_sera__cutin.png', work, { kind: 'cutin', out: 'game', at: '2026-10-23T00:00:00.000Z' });
    expect(r).toMatchObject({ kind: 'cutin', size: [1280, 480], dest: 'game/cutin_hero_sera' });
    const img = decodePng(readFileSync(join(work, 'game/cutin_hero_sera/cutin.png')));
    expect([img.w, img.h, img.rgba[3], img.rgba[(240 * 1280 + 400) * 4 + 3]]).toEqual([1280, 480, 0, 255]);
    const m = JSON.parse(readFileSync(join(work, 'game/cutin_hero_sera/cutin_hero_sera_manifest.json'), 'utf8'));
    expect(m).toMatchObject({ kind: 'cutin', quality: 'candidate', provenance: { aiUsed: true, rightsReviewed: false, promptRecord: 'out/prompts/hero_sera/cutin.txt' } });
    expect(readFileSync(join(work, 'out/prompts/hero_sera/cutin.txt'), 'utf8')).toMatch(/Ultimate attack cut-in[\s\S]*#00FF00/);
    expect(() => intakeCommand('inbox/hero_sera__cutin.png', work, { kind: 'poster' })).toThrow(expect.objectContaining({ code: 'intake.kind' }));
  });
});
