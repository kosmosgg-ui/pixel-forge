import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { sceneCommand } from './scene.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-scene-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('forge scene', () => {
  it('Spec·애니·프레임을 발밑 위치에 놓은 목업 → out/scenes/<이름>.png, 같은 Spec은 한 번 렌더, data/scenes 밖은 io.path-escape', () => {
    mkdirSync(join(work, 'data', 'scenes'), { recursive: true });
    writeFileSync(join(work, 'data', 'scenes', 't.scene.json'), JSON.stringify({ size: [96, 64], scale: 1, items: [
      { spec: 'data/specs/sample/warrior.spec.json', at: [30, 60] },
      { spec: 'data/specs/sample/goblin.spec.json', anim: 'idle', index: 1, at: [70, 58] },
      { spec: 'data/specs/sample/goblin.spec.json', at: [50, 40] },
    ] }));
    expect(sceneCommand('data/scenes/t.scene.json', work)).toMatchObject({ ok: true, items: 3, specs: 2, size: [96, 64], out: 'out/scenes/t.png' });
    expect(() => sceneCommand('data/specs/sample/warrior.spec.json', work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });
});
