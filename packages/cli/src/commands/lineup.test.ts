import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '../io/png.js';
import { lineupCommand } from './lineup.js';

const work = mkdtempSync(join(tmpdir(), 'forge-lineup-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** w×h 투명 캔버스에 (x0..x1, y0..y1) 빨간 사각형 */
function png(name: string, w: number, h: number, x0: number, x1: number, y0: number, y1: number): string {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rgba.set([255, 0, 0, 255], (y * w + x) * 4);
  mkdirSync(join(work, 'refs'), { recursive: true });
  writeFileSync(join(work, 'refs', name), encodePng({ w, h, rgba }));
  return `refs/${name}`;
}

describe('forge lineup', () => {
  it('항목마다 bbox로 잘라 같은 배율로 한 줄(발밑 맞춤), out/ 밖·빈 목록은 오류', () => {
    const a = png('a.png', 10, 10, 2, 4, 3, 8), b = png('b.png', 20, 20, 5, 6, 10, 13);
    const r = lineupCommand('out/judge/t.png', [a, b], work, 2);
    expect(r).toMatchObject({ ok: true, sizes: [[3, 6], [2, 4]], scale: 2, out: 'out/judge/t.png' });
    const img = decodePng(readFileSync(join(work, r.out)));
    // 폭 = (여백 4 + 3 + 4 + 2 + 4) × 2, 높이 = (6 + 여백 8) × 2
    expect([img.w, img.h]).toEqual([34, 28]);
    // 두 번째 항목은 발밑(아래)을 맞춘다: 맨 아래 줄 y = (4 + 6 - 1) × 2 에 빨강
    const at = (x: number, y: number) => [...img.rgba.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 3)];
    expect(at((4 + 3 + 4) * 2, (4 + 6 - 1) * 2)).toEqual([255, 0, 0]);
    expect(at(0, 0)).not.toEqual([255, 0, 0]);
    expect(() => lineupCommand('docs/x.png', [a], work)).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    expect(() => lineupCommand('out/x.png', [], work)).toThrow(expect.objectContaining({ code: 'cli.lineup' }));
  });
});
