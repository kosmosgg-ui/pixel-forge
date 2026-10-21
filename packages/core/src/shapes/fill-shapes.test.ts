import { describe, expect, it } from 'vitest';
import { rasterCapsule } from './capsule.js';
import { rasterEllipse } from './ellipse.js';
import { rasterPoly } from './poly.js';
import { rasterRect } from './rect.js';
import { at, count, filledWidth, is4Connected, isMirrorX, isMirrorY } from './test-util.js';
import { ForgeError } from '../errors.js';

describe('ellipse', () => {
  it('폭 1~16 원이 상하좌우 대칭이고 4-연결', () => {
    for (let w = 1; w <= 16; w++) {
      const m = rasterEllipse({ w, h: w });
      expect([m.w, m.h]).toEqual([w, w]);
      expect(isMirrorX(m)).toBe(true);
      expect(isMirrorY(m)).toBe(true);
      expect(is4Connected(m)).toBe(true);
    }
  });

  it('w=6 원은 좌우 대칭이고 폭이 정확히 6px', () => {
    const m = rasterEllipse({ w: 6, h: 6 });
    expect(isMirrorX(m)).toBe(true);
    expect(filledWidth(m)).toBe(6);
    expect([m.ox, m.oy]).toEqual([-3, -3]);
  });

  it('짝수·홀수 타원 박스 크기가 그대로', () => {
    const m = rasterEllipse({ w: 8, h: 5 });
    expect([m.w, m.h, filledWidth(m)]).toEqual([8, 5, 8]);
  });

  it('90° 회전은 가로세로가 바뀌고 픽셀 수가 같다', () => {
    const a = rasterEllipse({ w: 9, h: 4 });
    const b = rasterEllipse({ w: 9, h: 4, angleDeg: 90 });
    expect([b.w, b.h]).toEqual([4, 9]);
    expect(count(b)).toBe(count(a));
  });

  it('법선: 가운데는 화면을 향하고 왼쪽 끝은 왼쪽을 향한다', () => {
    const m = rasterEllipse({ w: 9, h: 9 });
    const n = (x: number, y: number) => Array.from(m.normals?.subarray((y * m.w + x) * 3, (y * m.w + x) * 3 + 3) ?? []);
    expect(n(4, 4)).toEqual([0, 0, 127]);
    expect(n(0, 4)[0]).toBeLessThan(-100);
  });
});

describe('rect', () => {
  it('w×h 그대로, chamfer 1은 귀퉁이 4픽셀만 뺀다', () => {
    expect(count(rasterRect({ w: 6, h: 4 }))).toBe(24);
    const c = rasterRect({ w: 6, h: 4, chamfer: 1 });
    expect(count(c)).toBe(20);
    expect([at(c, 0, 0), at(c, 5, 3), at(c, 1, 0)]).toEqual([0, 0, 1]);
  });

  it('회전 0/90/180°에서 픽셀 수 동일', () => {
    const n = [0, 90, 180, 270].map((a) => count(rasterRect({ w: 7, h: 4, chamfer: 1, angleDeg: a })));
    expect(new Set(n).size).toBe(1);
  });
});

describe('capsule', () => {
  it('회전 0°에서 바운딩 박스 = len × w (짝수 두께)', () => {
    const m = rasterCapsule({ len: 10, w: 4 });
    expect([m.w, m.h, filledWidth(m)]).toEqual([10, 4, 10]);
    expect(isMirrorX(m) && isMirrorY(m)).toBe(true);
  });

  it('회전 0°/90°/180° 캡슐이 회전 전과 픽셀 수 동일', () => {
    for (const [len, w] of [[10, 4], [9, 3], [12, 5]] as const) {
      const n = [0, 90, 180].map((a) => count(rasterCapsule({ len, w, angleDeg: a })));
      expect(n[1]).toBe(n[0]);
      expect(n[2]).toBe(n[0]);
    }
  });

  it('45° 회전도 4-연결', () => {
    expect(is4Connected(rasterCapsule({ len: 12, w: 4, angleDeg: 45 }))).toBe(true);
  });
});

describe('poly', () => {
  it('정수 사각형 다각형은 그 칸을 정확히 채운다', () => {
    const m = rasterPoly({ pts: [[0, 0], [4, 0], [4, 3], [0, 3]] });
    expect([m.ox, m.oy, m.w, m.h, count(m)]).toEqual([0, 0, 4, 3, 12]);
  });

  it('꼭짓점 12개 초과는 ForgeError', () => {
    const pts = Array.from({ length: 13 }, (_, i) => [Math.cos(i), Math.sin(i)] as [number, number]);
    expect(() => rasterPoly({ pts })).toThrow(ForgeError);
  });
});
