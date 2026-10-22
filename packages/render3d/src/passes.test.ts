import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { DIRECTIONS, bpyPython } from './blender.js';
import { frameMs, readPasses } from './passes.js';

const dir = mkdtempSync(join(tmpdir(), 'forge-passes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function png(path: string, w: number, h: number, px: (x: number, y: number) => [number, number, number, number]) {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y).forEach((v, c) => { p.data[(y * w + x) * 4 + c] = v; });
  writeFileSync(path, PNG.sync.write(p));
}

describe('render3d passes', () => {
  it('frameMs: 원본 프레임 간격 → ms(마지막은 앞 간격)', () => {
    expect(frameMs([0, 6, 12], 24)).toEqual([250, 250, 250]);
    expect(frameMs([0], 24)).toEqual([42]);
  });

  it('readPasses: id(R 재질·G 오브젝트)·법선(카메라 → 화면 공간)·알베도, 같은 행렬 해시는 같은 변환 키', () => {
    writeFileSync(join(dir, 'passes.json'), JSON.stringify({
      materials: ['Body'], objects: [{ name: 'A', skinned: false }, { name: 'B', skinned: true }], fps: 24, pxPerUnit: 10,
      frames: [{ anim: 'idle', dir: 's', index: 0, frame: 0, objects: ['h1', 'h2'] }, { anim: 'idle', dir: 's', index: 1, frame: 6, objects: ['h1', 'h2'] }],
    }));
    for (const i of [0, 1]) {
      png(join(dir, `idle_s_${i}_id.png`), 2, 2, (x) => (x ? [0, 0, 0, 0] : [1, 2, 0, 255]));
      // 카메라 공간 법선 (0, 1, -1)/√2 근처 = 위·카메라 쪽 → 화면 공간 y 음수(위), z 양수(보는 쪽)
      png(join(dir, `idle_s_${i}_nrm.png`), 2, 2, () => [128, 218, 38, 255]);
      png(join(dir, `idle_s_${i}_alb.png`), 2, 2, () => [10, 20, 30, 255]);
    }
    const p = readPasses(dir, [1, 1], 2, { idle: [0, 6] });
    const f = p.frames[0];
    expect(f?.mat[0]).toBe(1);
    expect(f?.obj[0]).toBe(2);
    expect(f?.mat[1]).toBe(0);
    expect((f?.normal[1] ?? 0) < -80 && (f?.normal[2] ?? 0) > 80).toBe(true);
    expect([...(f?.albedo.slice(0, 3) ?? [])]).toEqual([10, 20, 30]);
    expect(f?.ms).toBe(250);
    // 리지드 오브젝트(A)는 두 프레임 같은 키, 스키닝(B)은 매번 다른 키
    expect(p.frames[1]?.transforms[0]).toBe(f?.transforms[0]);
    expect(p.frames[1]?.transforms[1]).not.toBe(f?.transforms[1]);
  });

  it('방향 표·bpy 파이썬 없음 안내', () => {
    expect(Object.keys(DIRECTIONS[8])).toEqual(['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']);
    expect(() => bpyPython(dir, {})).toThrow(expect.objectContaining({ code: 'render3d.no-bpy' }));
  });
});
