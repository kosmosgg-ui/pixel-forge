import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { Report } from '@pixel-forge/qa';
import { decodePng } from '../io/png.js';
import { buildAllCommand } from './build.js';
import { crowdCommand } from './crowd.js';
import { renderCommand } from './render.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-anim-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));
const sha = (rel: string) => createHash('sha256').update(readFileSync(join(work, rel))).digest('hex');

describe('forge render --anim', () => {
  it('rest + 지정 애니 프레임, 우향·좌향 파일, 좌향은 우향의 좌우 반전', () => {
    const r = renderCommand('data/specs/sample/rogue.spec.json', work, ['attack']);
    expect(r).toMatchObject({ ok: true, frames: 7 });
    const right = decodePng(readFileSync(join(work, 'out/rogue/frames/attack_r_2.png')));
    const left = decodePng(readFileSync(join(work, 'out/rogue/frames/attack_l_2.png')));
    const at = (img: typeof right, x: number, y: number) => img.rgba[(y * img.w + x) * 4 + 3];
    for (let y = 0; y < right.h; y++) for (let x = 0; x < right.w; x++) expect(at(left, right.w - 1 - x, y)).toBe(at(right, x, y));
  });
});

describe('build-all sample (3종 × 4애니)', () => {
  const r = buildAllCommand('sample', work);

  it('필수 검사 전부 통과, 깜빡임 0, 발밑 고정, 무기 보임', () => {
    expect(r).toMatchObject({ ok: true, count: 3, pass: true });
    for (const id of ['warrior', 'rogue', 'mage']) {
      const report = JSON.parse(readFileSync(join(work, 'out', id, 'qa.json'), 'utf8')) as Report;
      const get = (cid: string) => report.checks.find((c) => c.id === cid);
      expect(get('anim.flicker')).toMatchObject({ pass: true, value: 0 });
      expect(get('baseline.stable')).toMatchObject({ pass: true, value: 0 });
      // 손에 든 무기·소품은 모든 프레임에서 보이고 손에 붙어 있다
      expect(get('form.held-visible')).toMatchObject({ pass: true });
      expect(existsSync(join(work, 'out', id, 'frames', 'death_l_3.png'))).toBe(true);
      expect(JSON.parse(readFileSync(join(work, 'out', id, 'motion.json'), 'utf8'))).toMatchObject({ bob: { px: 1 } });
    }
  });
});

describe('forge crowd', () => {
  it('같은 시드 → 같은 바이트, 1배는 바이블 내부 해상도, 2배본 동시 출력', () => {
    const a = crowdCommand('sample', work, 50, 1);
    const first = sha(a.out);
    crowdCommand('sample', work, 50, 1);
    expect(sha(a.out)).toBe(first);
    expect(a).toMatchObject({ ok: true, count: 50, size: [320, 180] });
    const big = decodePng(readFileSync(join(work, 'out/sample/crowd@2x.png')));
    expect([big.w, big.h]).toEqual([640, 360]);
    crowdCommand('sample', work, 50, 2);
    expect(sha(a.out)).not.toBe(first);
  });
});
