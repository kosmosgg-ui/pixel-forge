import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildBiblePalette, ForgeError } from '@pixel-forge/core';
import { bibleColorsSchema, rulesColorSchema } from '@pixel-forge/spec';
import { readJson } from '../io/files.js';
import { decodePng } from '../io/png.js';
import { paletteCommand } from './palette.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-palette-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('forge palette', () => {
  it('out/palette/<id>.png를 쓰고 한 줄 요약을 돌려준다', () => {
    const r = paletteCommand('sample-v0', work);
    expect(r).toMatchObject({ ok: true, cmd: 'palette', bible: 'sample-v0', materials: 14, out: join('out', 'palette', 'sample-v0.png') });
    const img = decodePng(readFileSync(join(work, r.out)));
    for (let i = 3; i < img.rgba.length; i += 4) expect([0, 255]).toContain(img.rgba[i]);
  });

  it('golden: 같은 바이블 → 같은 PNG 바이트', () => {
    const r = paletteCommand('sample-v0', work);
    const hash = createHash('sha256').update(readFileSync(join(work, r.out))).digest('hex');
    expect(hash).toMatchSnapshot();
  });

  it('sample-v0: #ffffff는 fx에만 있다', () => {
    const bp = buildBiblePalette(
      readJson(join(work, 'data', 'bibles', 'sample-v0.bible.json'), bibleColorsSchema),
      readJson(join(work, 'data', 'rules', 'default.rules.json'), rulesColorSchema),
    );
    const white = Array.from(bp.palette.colors).indexOf(0xffffffff);
    expect(bp.fxIndices).toContain(white);
    for (const r of Object.values(bp.ramps)) expect([...r.indices, r.outline]).not.toContain(white);
  });

  it('없는 바이블은 ForgeError', () => {
    expect(() => paletteCommand('nope', work)).toThrow(ForgeError);
  });
});

describe('forge palette 경로 안전', () => {
  it('../ 로 저장소 밖 파일을 가리키면 io.path-escape', () => {
    for (const ref of ['../../etc/x.json', '../evil']) {
      try {
        paletteCommand(ref, work);
        expect.unreachable(ref);
      } catch (e) {
        expect((e as ForgeError).code).toBe('io.path-escape');
      }
    }
  });
});
