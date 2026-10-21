import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { renderCommand } from './render.js';
import { validateCommand } from './validate.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-render-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));
const sha = (rel: string) => createHash('sha256').update(readFileSync(join(work, rel))).digest('hex');

/** 단색 원 하나짜리 바이블·리그·Spec을 임시 프로젝트에 쓴다 */
function circleProject(mode: 'selout' | 'dark' | 'none'): string {
  const bible = JSON.parse(readFileSync(join(repo, 'data/bibles/sample-v0.bible.json'), 'utf8'));
  bible.id = `circle-${mode}`;
  bible.outline.mode = mode;
  writeFileSync(join(work, 'data/bibles', `circle-${mode}.bible.json`), JSON.stringify(bible));
  mkdirSync(join(work, 'data/specs/golden'), { recursive: true });
  const spec = {
    id: `circle-${mode}`, kind: 'character', bible: `circle-${mode}`, sizeClass: 'smallMonster', rig: 'humanoid-side-v1',
    parts: [{ bone: 'root', shape: { type: 'ellipse', w: 12, h: 12 }, material: 'cloth_red', orient: 'world' }],
  };
  const path = join('data/specs/golden', `circle-${mode}.spec.json`);
  writeFileSync(join(work, path), JSON.stringify(spec));
  return path;
}

describe('forge validate', () => {
  it.each(['warrior', 'rogue', 'mage'])('샘플 %s 통과', (id) => {
    expect(validateCommand(`data/specs/sample/${id}.spec.json`, work)).toMatchObject({ ok: true, id, kind: 'character' });
  });

  it('참조 오류는 spec.refs와 목록', () => {
    const bad = JSON.parse(readFileSync(join(work, 'data/specs/sample/rogue.spec.json'), 'utf8'));
    bad.parts[0].bone = 'tail';
    writeFileSync(join(work, 'bad.spec.json'), JSON.stringify(bad));
    try {
      validateCommand('bad.spec.json', work);
      expect.unreachable();
    } catch (e) {
      expect((e as ForgeError).code).toBe('spec.refs');
      expect(JSON.stringify((e as ForgeError).detail)).toContain('tail');
    }
  });
});

describe('forge render (golden)', () => {
  it.each(['selout', 'dark', 'none'] as const)('단색 원 외곽선 %s', (mode) => {
    const r = renderCommand(circleProject(mode), work);
    expect(r).toMatchObject({ ok: true, frames: 1, size: [32, 32], clipped: 0 });
    expect(sha(r.out)).toMatchSnapshot();
  });

  it.each(['warrior', 'rogue', 'mage'])('샘플 %s rest 프레임', (id) => {
    const r = renderCommand(`data/specs/sample/${id}.spec.json`, work);
    expect(r).toMatchObject({ ok: true, out: join('out', id, 'frames', 'rest.png'), clipped: 0 });
    expect(sha(r.out)).toMatchSnapshot();
  });
});
