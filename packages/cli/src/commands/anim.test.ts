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
import { reviewCommand } from './review.js';

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

describe('build-all sample (8종 × 4애니, P4 기준 3종은 얼굴 가림까지)', () => {
  const r = buildAllCommand('sample', work);

  it('필수 검사 전부 통과, 깜빡임 0, 발밑 고정, 무기 보임, 얼굴 가림 없음', () => {
    expect(r).toMatchObject({ ok: true, count: 8, pass: true });
    for (const id of ['warrior', 'rogue', 'mage']) {
      const report = JSON.parse(readFileSync(join(work, 'out', id, 'qa.json'), 'utf8')) as Report;
      const get = (cid: string) => report.checks.find((c) => c.id === cid);
      expect(get('anim.flicker')).toMatchObject({ pass: true, value: 0 });
      expect(get('baseline.stable')).toMatchObject({ pass: true, value: 0 });
      // 손에 든 무기·소품은 모든 프레임에서 보이고 손에 붙어 있다
      expect(get('form.held-visible')).toMatchObject({ pass: true });
      // 공격 준비 자세 포함 모든 프레임에서 얼굴이 가려지지 않고 무기가 머리 위에 오지 않는다
      expect(get('form.face-clear')).toMatchObject({ pass: true });
      expect(existsSync(join(work, 'out', id, 'frames', 'death_l_3.png'))).toBe(true);
      expect(JSON.parse(readFileSync(join(work, 'out', id, 'motion.json'), 'utf8'))).toMatchObject({ bob: { px: 1 } });
      // QA 통과 → pack: 시트 JSON 태그 범위 = 애니 프레임 수, manifest에 같은 프레임 이름
      const sheet = JSON.parse(readFileSync(join(work, 'out', id, `${id}.json`), 'utf8')) as { frames: Record<string, unknown>; meta: { frameTags: { name: string; from: number; to: number }[] } };
      const len = Object.fromEntries(sheet.meta.frameTags.map((t) => [t.name, t.to - t.from + 1]));
      expect(len).toEqual({ rest_r: 1, idle_r: 4, attack_r: 6, hit_r: 3, death_r: 4 });
      const manifest = JSON.parse(readFileSync(join(work, 'out', id, 'manifest.json'), 'utf8')) as { anims: Record<string, { frames: string[] }> };
      expect(Object.values(manifest.anims).flatMap((a) => a.frames)).toEqual(Object.keys(sheet.frames));
      // 바닥 그림자 힌트: 발 폭 + 4, 높이 3 (엔진이 그린다)
      expect((JSON.parse(readFileSync(join(work, 'out', id, 'manifest.json'), 'utf8')) as { motion: { shadow: { w: number; h: number } } }).motion.shadow).toMatchObject({ h: 3 });
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

describe('forge review', () => {
  it('캐릭터 × (rest + 애니 전 프레임), 4배, 같은 입력 → 같은 바이트', () => {
    const r = reviewCommand('sample', work);
    expect(r).toMatchObject({ ok: true, kinds: 8, frames: [18, 18, 16, 18, 18, 18, 16, 18], scale: 4, out: 'out/sample/review.png' });
    const first = sha(r.out);
    reviewCommand('sample', work);
    expect(sha(r.out)).toBe(first);
    const img = decodePng(readFileSync(join(work, r.out)));
    expect([img.w, img.h]).toEqual(r.size);
  });
});
