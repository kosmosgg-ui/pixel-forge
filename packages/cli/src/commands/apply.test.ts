import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { LEDGER } from '../adapters/dir.js';
import { applyCommand } from './apply.js';
import { buildCommand } from './build.js';
import { reviewScoreCommand } from './review-gate.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-apply-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));
const spec = 'data/specs/sample/rogue.spec.json';

/** target 폴더를 뺀 작업 폴더 전체의 파일 → 내용 해시 */
function snapshot(skip: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (full.startsWith(skip)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(work, full), createHash('sha256').update(readFileSync(full)).digest('hex'));
    }
  };
  walk(work);
  return out;
}

describe('forge apply --target dir', () => {
  const game = join(work, 'game');
  beforeAll(() => {
    buildCommand(spec, work);
    // 검수 통과 기록(합격선 18/24) — 검수 게이트 자체는 아래 별도 테스트
    reviewScoreCommand(spec, work, 20);
  });

  it('<out>/<id>/에 시트 PNG·JSON·manifest 복사, 대상 폴더 밖 파일 변경 0', () => {
    const before = snapshot(game);
    const r = applyCommand(spec, work, { target: 'dir', out: 'game' });
    expect(r).toMatchObject({ ok: true, applied: true, written: ['rogue.png', 'rogue.json', 'manifest.json'], out: 'game/rogue' });
    expect(snapshot(game)).toEqual(before);
    expect(readFileSync(join(game, 'rogue', 'rogue.png'))).toEqual(readFileSync(join(work, 'out', 'rogue', 'rogue.png')));
  });

  it('다시 apply하면 바뀐 것 없음(unchanged), 결정론', () => {
    expect(applyCommand(spec, work, { out: 'game' })).toMatchObject({ written: [], unchanged: ['rogue.png', 'rogue.json', 'manifest.json'] });
  });

  it('forge가 만들지 않은(또는 수정된) 같은 이름 파일은 덮어쓰지 않고 apply.foreign-file, 아무것도 쓰지 않음', () => {
    const other = join(work, 'game2', 'rogue');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'manifest.json'), 'mine\n');
    expect(() => applyCommand(spec, work, { out: 'game2' })).toThrow(expect.objectContaining({ code: 'apply.foreign-file' }));
    expect(readFileSync(join(other, 'manifest.json'), 'utf8')).toBe('mine\n');
    expect(readdirSync(other)).toEqual(['manifest.json']);
    // forge가 쓴 파일도 사람이 고쳤으면 지키고, 기록(LEDGER)에 없는 파일은 그대로 둔다
    writeFileSync(join(game, 'rogue', 'rogue.json'), '{}\n');
    writeFileSync(join(game, 'rogue', 'notes.txt'), 'keep\n');
    expect(() => applyCommand(spec, work, { out: 'game' })).toThrow(ForgeError);
    expect(readFileSync(join(game, 'rogue', 'notes.txt'), 'utf8')).toBe('keep\n');
    expect(Object.keys(JSON.parse(readFileSync(join(game, 'rogue', LEDGER), 'utf8')).files)).not.toContain('notes.txt');
  });

  it('작업 폴더 밖 --out은 io.path-escape, 모르는 어댑터는 apply.unknown-target', () => {
    expect(() => applyCommand(spec, work, { out: '../outside' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    expect(() => applyCommand(spec, work, { target: 'godot', out: 'game' })).toThrow(expect.objectContaining({ code: 'apply.unknown-target' }));
  });

  it('대상 안 심볼릭 링크(폴더·파일)를 따라 밖에 쓰지 않는다 → io.path-escape, 밖 파일 그대로', () => {
    const outside = join(work, 'outside-target');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'rogue.png'), 'victim\n');
    mkdirSync(join(work, 'game3'), { recursive: true });
    symlinkSync(outside, join(work, 'game3', 'rogue'));
    expect(() => applyCommand(spec, work, { out: 'game3' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    mkdirSync(join(work, 'game4', 'rogue'), { recursive: true });
    symlinkSync(join(outside, 'rogue.png'), join(work, 'game4', 'rogue', 'rogue.png'));
    expect(() => applyCommand(spec, work, { out: 'game4' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    expect(readFileSync(join(outside, 'rogue.png'), 'utf8')).toBe('victim\n');
    expect(readdirSync(outside)).toEqual(['rogue.png']);
  });

  it('기록에 없어도 내용이 같은 파일은 받아들이고, 같은 이름 폴더는 apply.foreign-file', () => {
    const dest = join(work, 'game5', 'rogue');
    mkdirSync(dest, { recursive: true });
    cpSync(join(work, 'out', 'rogue', 'rogue.png'), join(dest, 'rogue.png'));
    expect(applyCommand(spec, work, { out: 'game5' })).toMatchObject({ unchanged: ['rogue.png'], written: ['rogue.json', 'manifest.json'] });
    const d6 = join(work, 'game6', 'rogue', 'manifest.json');
    mkdirSync(d6, { recursive: true });
    expect(() => applyCommand(spec, work, { out: 'game6' })).toThrow(expect.objectContaining({ code: 'apply.foreign-file' }));
    expect(existsSync(join(work, 'game6', 'rogue', 'rogue.png'))).toBe(false);
  });

  it('작업 폴더 밖은 허용 목록(.forge/targets.local.json)의 @이름으로만: 없으면 만드는 법 안내, 없는 이름은 io.path-escape', () => {
    expect(() => applyCommand(spec, work, { out: '@ext' })).toThrow(expect.objectContaining({ code: 'io.path-escape', message: expect.stringContaining('직접 만드세요') }));
    const ext = mkdtempSync(join(tmpdir(), 'forge-ext-'));
    try {
      mkdirSync(join(work, '.forge'), { recursive: true });
      writeFileSync(join(work, '.forge', 'targets.local.json'), JSON.stringify({ targets: { ext } }));
      expect(applyCommand(spec, work, { out: '@ext' })).toMatchObject({ applied: true, out: join(ext, 'rogue') });
      expect(existsSync(join(ext, 'rogue', 'rogue.json'))).toBe(true);
      expect(() => applyCommand(spec, work, { out: '@nope' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
      expect(() => applyCommand(spec, work, { out: ext })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    } finally {
      rmSync(ext, { recursive: true, force: true });
      rmSync(join(work, '.forge'), { recursive: true, force: true });
    }
  });

  it('검수 게이트(기본): 기록 없음·합격선 미만·검수 후 입력 변경 → 복사하지 않고 pass:false(exit 2), --skip-review면 복사', () => {
    const mage = 'data/specs/sample/mage.spec.json';
    buildCommand(mage, work);
    rmSync(join(work, 'out', 'mage', 'review.json'), { force: true });
    expect(applyCommand(mage, work, { out: 'gate' })).toMatchObject({ pass: false, applied: false, review: expect.stringContaining('검수 기록이 없습니다') });
    reviewScoreCommand(mage, work, 17);
    expect(applyCommand(mage, work, { out: 'gate' })).toMatchObject({ pass: false, review: expect.stringContaining('17/24') });
    reviewScoreCommand(mage, work, 21);
    // build가 출력 폴더를 비워도 검수 기록은 남는다
    buildCommand(mage, work);
    expect(applyCommand(mage, work, { out: 'gate' })).toMatchObject({ pass: true, applied: true });
    const path = join(work, mage);
    writeFileSync(path, readFileSync(path, 'utf8') + '\n');
    expect(applyCommand(mage, work, { out: 'gate2' })).toMatchObject({ pass: false, review: expect.stringContaining('바뀌었습니다') });
    expect(existsSync(join(work, 'gate2'))).toBe(false);
    expect(applyCommand(mage, work, { out: 'gate2', skipReview: true })).toMatchObject({ pass: true, applied: true });
  });

  it('review-score는 QA 통과한 build 결과가 있어야 기록(review.no-build)', () => {
    const p = join(work, 'data/specs/sample/nobuild.spec.json');
    const spec = JSON.parse(readFileSync(join(work, 'data/specs/sample/rogue.spec.json'), 'utf8'));
    writeFileSync(p, JSON.stringify({ ...spec, id: 'nobuild' }));
    try {
      expect(() => reviewScoreCommand('data/specs/sample/nobuild.spec.json', work, 20)).toThrow(expect.objectContaining({ code: 'review.no-build' }));
    } finally { rmSync(p); }
  });
});
