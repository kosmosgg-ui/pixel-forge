import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAllCommand, buildCommand } from './build.js';
import { qaCommand } from './qa.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-build-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));
const ROGUE = 'data/specs/sample/rogue.spec.json';
const bytes = (rel: string) => readFileSync(join(work, rel));

describe('forge build (캐시)', () => {
  it('같은 Spec 2회 build → 두 번째 cached:true, 출력 바이트 동일', () => {
    const a = buildCommand(ROGUE, work);
    const first = ['frames/rest.png', 'qa.json', 'sheet.png'].map((f) => bytes(join(a.out, f)));
    // 출력 폴더를 지워 두 번째 결과가 캐시 복원에서만 오게 한다
    rmSync(join(work, a.out), { recursive: true, force: true });
    const b = buildCommand(ROGUE, work);
    expect([a.cached, b.cached]).toEqual([false, true]);
    ['frames/rest.png', 'qa.json', 'sheet.png'].forEach((f, i) => expect(bytes(join(b.out, f)).equals(first[i] ?? Buffer.alloc(0))).toBe(true));
  });

  it('Spec 한 글자 수정 → 캐시 미스', () => {
    buildCommand(ROGUE, work);
    const path = join(work, ROGUE);
    writeFileSync(path, readFileSync(path, 'utf8').replace('"seed": 1', '"seed": 2'));
    expect(buildCommand(ROGUE, work).cached).toBe(false);
  });

  it('출력 형식: pass·score·failed·cached·out', () => {
    expect(buildCommand(ROGUE, work)).toMatchObject({ ok: true, cmd: 'build', id: 'rogue', pass: true, out: join('out', 'rogue') });
  });
});

describe('forge qa / build-all', () => {
  it('qa는 out/<id>/qa.json과 sheet.png를 쓴다', () => {
    const r = qaCommand(ROGUE, work);
    const report = JSON.parse(bytes(r.out).toString('utf8'));
    expect(report.checks.length).toBeGreaterThanOrEqual(12);
    expect(report.sheet.path).toBe(join('out', 'rogue', 'sheet.png'));
    expect(report.budget).toMatchObject({ limit: 15 });
  });

  it('사람 크기 Spec을 smallMonster로 요청 → 자동으로 들어가는 등급(character)으로 올림, sizeClassLock이면 bounds.canvas 실패(pass:false, 종료 코드 2)', () => {
    const p = join(work, 'data/specs/sample/tiny.spec.json');
    const spec = JSON.parse(bytes('data/specs/sample/rogue.spec.json').toString('utf8'));
    try {
      writeFileSync(p, JSON.stringify({ ...spec, id: 'tiny', sizeClass: 'smallMonster' }));
      expect(buildCommand('data/specs/sample/tiny.spec.json', work)).toMatchObject({ pass: true, sizeClass: { requested: 'smallMonster', used: 'character', reason: 'bounds' } });
      writeFileSync(p, JSON.stringify({ ...spec, id: 'tiny', sizeClass: 'smallMonster', sizeClassLock: true }));
      expect(buildCommand('data/specs/sample/tiny.spec.json', work)).toMatchObject({
        pass: false, failed: expect.arrayContaining(['bounds.canvas']), sizeClass: { used: 'smallMonster', reason: 'locked' },
      });
    } finally {
      rmSync(p);
    }
  });

  it('build-all: 교차 검사가 각 qa.json에 들어간다', () => {
    const r = buildAllCommand('sample', work);
    expect(r).toMatchObject({ ok: true, cmd: 'build-all', count: 8 });
    const report = JSON.parse(bytes('out/mage/qa.json').toString('utf8'));
    const ids = report.checks.map((c: { id: string }) => c.id);
    expect(ids).toContain('form.silhouette');
    expect(ids).toContain('scale.consistency');
  });
});
