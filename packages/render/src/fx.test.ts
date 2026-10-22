import { describe, expect, it } from 'vitest';
import { createIndexed } from '@pixel-forge/core';
import { applyFxInPlace, scaleFx } from './fx.js';

const bones = { handB: { x: 2, y: 1, angle: 0, length: 1 } };

describe('line fx', () => {
  it('관절 + origin에서 dirDeg 방향으로 from..from+length 칸을 fx 색으로, protect 표시', () => {
    const r = createIndexed(10, 5), protect = new Uint8Array(50);
    applyFxInPlace(r, { type: 'line', bone: 'handB', length: 3, dirDeg: 0, from: 1, color: 0 }, bones, [1, 1], [7], protect);
    const lit = [...r.px].flatMap((v, k) => (v ? [[k % 10, Math.floor(k / 10), v]] : []));
    expect(lit).toEqual([[4, 2, 7], [5, 2, 7], [6, 2, 7], [7, 2, 7]]);
    expect(protect[2 * 10 + 4]).toBe(1);
  });

  it('캔버스 밖 칸은 건너뛰고, 없는 뼈·fx 색이면 아무것도 쓰지 않는다', () => {
    const r = createIndexed(5, 5), protect = new Uint8Array(25);
    applyFxInPlace(r, { type: 'line', bone: 'handB', length: 9, dirDeg: 0, from: 0, color: 0 }, bones, [0, 0], [3], protect);
    expect([...r.px].filter(Boolean)).toHaveLength(3);
    applyFxInPlace(r, { type: 'line', bone: 'nope', length: 2, dirDeg: 90, from: 0, color: 0 }, bones, [0, 0], [3], protect);
    applyFxInPlace(r, { type: 'line', bone: 'handB', length: 2, dirDeg: 90, from: 0, color: 5 }, bones, [0, 0], [3], protect);
    expect([...r.px].filter(Boolean)).toHaveLength(3);
  });

  it('scaleFx: line 길이만 리그 축척(반올림, 최소 1) — from은 관절에서 띄우는 간격이라 그대로', () => {
    expect(scaleFx({ type: 'line', bone: 'handB', length: 6, dirDeg: 0, from: 2, color: 0 }, 1.5)).toMatchObject({ length: 9, from: 2 });
    expect(scaleFx({ type: 'line', bone: 'handB', length: 1, dirDeg: 0, from: 0, color: 0 }, 0.2)).toMatchObject({ length: 1 });
  });
});
