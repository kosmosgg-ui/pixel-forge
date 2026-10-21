import { describe, expect, it } from 'vitest';
import { formHeldVisible } from './checks/held.js';
import { ctx, frame } from './test-fixture.js';

// 파츠 1 = 손, 2 = 무기(날), 3 = 날밑(같은 뼈)
const parts = (rows: string[]) => Uint16Array.from(rows.join('').split('').map((ch) => (ch === 'h' ? 1 : ch === 'w' ? 2 : ch === 'g' ? 3 : 0)));
const held = [{ part: 2, name: 'sword', hand: [1], restCount: 4 }];

describe('form.held-visible', () => {
  const rows = ['.....', '.hww.', '..ww.', '.....'];

  it('보이는 무기 픽셀이 rest의 60% 이상이고 손에 붙어 있으면 통과', () => {
    const c = formHeldVisible([frame(['.....', '.233.', '..33.', '.....'], { part: parts(rows) })], ctx({ held }));
    expect([c.required, c.pass, c.value]).toEqual([true, true, 1]);
  });

  it('무기가 선 색(외곽선 톤)으로만 칠해져 보이는 픽셀이 부족하면 실패', () => {
    const c = formHeldVisible([frame(['.....', '.211.', '..13.', '.....'], { part: parts(rows) })], ctx({ held, lineIndices: new Set([1]) }));
    expect([c.pass, c.value]).toEqual([false, 0.25]);
    expect(c.note).toContain('보이는 픽셀 1/4');
  });

  it('손에서 떨어져 떠 있으면 실패', () => {
    const away = ['.....', '.h...', '...ww', '...ww'];
    const c = formHeldVisible([frame(['.....', '.2...', '...33', '...33'], { part: parts(away) })], ctx({ held }));
    expect(c.pass).toBe(false);
    expect(c.note).toContain('손에서 떨어짐');
  });

  it('held 파츠가 없으면 통과', () => {
    expect(formHeldVisible([frame(rows)], ctx()).pass).toBe(true);
  });
  it('날밑·손잡이(같은 뼈 파츠)를 거쳐 손에 이어지면 붙은 것, 날밑만 떠 있으면 실패', () => {
    const viaGuard = ['.....', 'hg...', '.gww.', '..ww.'];
    const group = [{ ...held[0]!, group: [3] }];
    const px = ['.....', '24...', '.433.', '..33.'];
    expect(formHeldVisible([frame(px, { part: parts(viaGuard) })], ctx({ held: group })).pass).toBe(true);
    const floating = ['h....', '.....', '..gww', '...ww'];
    expect(formHeldVisible([frame(['2....', '.....', '..433', '...33'], { part: parts(floating) })], ctx({ held: group })).pass).toBe(false);
  });
});
