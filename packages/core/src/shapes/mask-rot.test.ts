import { describe, expect, it } from 'vitest';
import { ForgeError } from '../errors.js';
import { AUTO_SHADE, parseMaskGrid } from './mask-grid.js';
import { rotateMaskGrid } from './rotsprite.js';
import { count } from './test-util.js';

const hood = parseMaskGrid({
  origin: [2, 3],
  rows: ['..aa..', '.aAAa.', 'aAAAAa', '.aaaa.'],
  legend: { a: { material: 'cloth', shade: 1 }, A: { material: 'cloth' } },
});

describe('mask-grid', () => {
  it('legend를 재질 번호·shade로 바꾸고 origin을 앵커로', () => {
    expect([hood.w, hood.h, hood.ox, hood.oy]).toEqual([6, 4, -2, -3]);
    expect(hood.materials).toEqual(['cloth']);
    expect(count(hood)).toBe(16);
    expect(hood.shade[2]).toBe(1);
    expect(hood.shade[1 * 6 + 2]).toBe(AUTO_SHADE);
  });

  it('legend에 없는 문자, 들쭉날쭉한 행은 ForgeError', () => {
    expect(() => parseMaskGrid({ origin: [0, 0], rows: ['x'], legend: {} })).toThrow(ForgeError);
    expect(() => parseMaskGrid({ origin: [0, 0], rows: ['a', 'aa'], legend: { a: { material: 'm' } } })).toThrow(ForgeError);
  });
});

describe('rotsprite', () => {
  it('0°는 원본 그대로', () => {
    const r = rotateMaskGrid(hood, 0);
    expect([r.w, r.h, r.ox, r.oy]).toEqual([hood.w, hood.h, hood.ox, hood.oy]);
    expect(Array.from(r.mask)).toEqual(Array.from(hood.mask));
    expect(Array.from(r.shade)).toEqual(Array.from(hood.shade));
  });

  it('90°는 가로세로가 바뀌고 픽셀 수가 같으며 4번이면 원래대로', () => {
    const r1 = rotateMaskGrid(hood, 90);
    expect([r1.w, r1.h, count(r1)]).toEqual([4, 6, 16]);
    let r = hood;
    for (let i = 0; i < 4; i++) r = rotateMaskGrid(r, 90);
    expect([r.w, r.h, r.ox, r.oy]).toEqual([hood.w, hood.h, hood.ox, hood.oy]);
    expect(Array.from(r.material)).toEqual(Array.from(hood.material));
  });

  it('임의 각도에서도 재질 번호는 원본에 있던 값만', () => {
    const r = rotateMaskGrid(hood, 30);
    for (const v of r.material) expect([0, 1]).toContain(v);
    expect(count(r)).toBeGreaterThan(10);
  });
});
