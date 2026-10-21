import { describe, expect, it } from 'vitest';
import { fitBudgetInPlace } from './budget-fit.js';
import { bible, ctx, RULES, spec, circle } from './test-fixture.js';

describe('fitBudgetInPlace', () => {
  const c = ctx(spec([circle()]), bible({ materials: { m: { base: '#a83c3c', steps: 4, kind: 'cloth' }, n: { base: '#3c5aa8', steps: 4, kind: 'cloth' } } }));
  const m = c.palette.ramps.m!, n = c.palette.ramps.n!;
  const raster = () => ({ w: 12, h: 1, px: Uint8Array.from([...m.indices, m.indices[1]!, m.indices[1]!, ...n.indices, n.indices[2]!, n.indices[2]!]) });

  it('예산 이하가 될 때까지 가장 적게 쓰인 단계를 가까운 사용 중 단계로 병합', () => {
    const r = raster();
    const res = fitBudgetInPlace([r], [m, n], c.palette.palette, 6, new Set());
    expect(res.before).toBe(8);
    expect(res.after).toBe(6);
    expect(new Set(r.px).size).toBe(6);
    expect(res.merges[0]).toMatchObject({ material: 'm', from: 0, pixels: 1 });
  });

  it('제외 색은 병합하지 않고, 결정론', () => {
    const a = raster(), b = raster();
    const ra = fitBudgetInPlace([a], [m, n], c.palette.palette, 4, new Set([m.indices[0]!]));
    fitBudgetInPlace([b], [m, n], c.palette.palette, 4, new Set([m.indices[0]!]));
    expect(Array.from(a.px)).toEqual(Array.from(b.px));
    expect(a.px).toContain(m.indices[0]);
    expect(ra.merges.every((x) => !(x.material === 'm' && x.from === 0))).toBe(true);
  });

  it('병합할 수 없으면 멈추고 after에 남은 수를 적는다', () => {
    const r = { w: 2, h: 1, px: Uint8Array.from([m.indices[0]!, n.indices[0]!]) };
    expect(fitBudgetInPlace([r], [m, n], c.palette.palette, 1, new Set()).after).toBe(2);
  });

  it('규칙 값', () => {
    expect(RULES.budgetFit.smallPartArea).toBe(12);
    expect(RULES.cleanup.minCluster).toBe(3);
  });
});
