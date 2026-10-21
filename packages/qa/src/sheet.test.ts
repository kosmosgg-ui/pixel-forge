import { describe, expect, it } from 'vitest';
import { contactSheet } from './sheet.js';
import { CLEAN, frame, palette } from './test-fixture.js';
import { check } from './types.js';

describe('contactSheet', () => {
  it('프레임마다 체커 + 배경 2칸, 확대, 시트 전용 색은 별도 팔레트', () => {
    const base = palette();
    const s = contactSheet([[frame(CLEAN)]], base, [], { scale: 4, background: '#2a2238' });
    expect([s.raster.w, s.raster.h]).toEqual([4 + 2 * (24 + 4), 4 + 24 + 4]);
    expect(s.palette.colors.length).toBe(base.colors.length + 4);
    expect(base.colors.length).toBe(5);
  });

  it('실패 위치는 빨간 테두리', () => {
    const fail = check('bounds.canvas', true, false, 1, 0, { where: [[2, 2]] });
    const s = contactSheet([[frame(CLEAN)]], palette(), [fail], { scale: 4, background: '#2a2238' });
    const red = s.palette.colors.length - 1;
    expect(s.raster.px.filter((v) => v === red).length).toBeGreaterThan(0);
  });
});
