import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { decodePng } from '../io/png.js';
import { paletteCommand } from './palette.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-palette-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('forge palette', () => {
  it('out/palette/<id>.png를 쓰고 한 줄 요약을 돌려준다', () => {
    const r = paletteCommand('sample-v0', work);
    expect(r).toMatchObject({ ok: true, cmd: 'palette', bible: 'sample-v0', materials: 12, out: join('out', 'palette', 'sample-v0.png') });
    const img = decodePng(readFileSync(join(work, r.out)));
    for (let i = 3; i < img.rgba.length; i += 4) expect([0, 255]).toContain(img.rgba[i]);
  });

  it('golden: 같은 바이블 → 같은 PNG 바이트', () => {
    const r = paletteCommand('sample-v0', work);
    const hash = createHash('sha256').update(readFileSync(join(work, r.out))).digest('hex');
    expect(hash).toMatchSnapshot();
  });

  it('없는 바이블은 ForgeError', () => {
    expect(() => paletteCommand('nope', work)).toThrow(ForgeError);
  });
});
