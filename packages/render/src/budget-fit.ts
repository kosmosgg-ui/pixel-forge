import { srgbToOklab, type IndexedRaster, type Palette, type Ramp } from '@pixel-forge/core';

export interface BudgetMerge {
  material: string;
  from: number;
  to: number;
  pixels: number;
}

export interface BudgetFitResult {
  limit: number;
  before: number;
  after: number;
  merges: BudgetMerge[];
}

function labOf(p: Palette, i: number) {
  const c = p.colors[i] ?? 0;
  return srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255);
}

/**
 * rule: color.budget-fit — 고유 색 수 > limit이면 같은 재질 램프에서 가장 적게 쓰인 단계를
 * OKLab으로 가장 가까운 "사용 중인" 다른 단계로 병합한다. limit 이하가 되거나 병합할 수 없을 때까지.
 * exclude(외곽선 톤·눈 색·예약 색)는 병합하지 않는다. 동률이면 재질 키 순 → 단계 인덱스 낮은 쪽.
 */
export function fitBudgetInPlace(r: IndexedRaster, ramps: readonly Ramp[], palette: Palette, limit: number, exclude: ReadonlySet<number>): BudgetFitResult {
  const count = new Map<number, number>();
  for (const v of r.px) if (v) count.set(v, (count.get(v) ?? 0) + 1);
  const before = count.size;
  const merges: BudgetMerge[] = [];
  while (count.size > limit) {
    let pick: { ramp: Ramp; step: number; n: number } | null = null;
    for (const ramp of ramps) {
      const used = ramp.indices.filter((i) => count.has(i));
      if (used.length < 2) continue;
      ramp.indices.forEach((idx, step) => {
        const n = count.get(idx);
        if (n === undefined || exclude.has(idx)) return;
        if (!pick || n < pick.n) pick = { ramp, step, n };
      });
    }
    if (!pick) break;
    const { ramp, step, n } = pick as { ramp: Ramp; step: number; n: number };
    const from = ramp.indices[step] ?? 0;
    const a = labOf(palette, from);
    let to = -1, bestD = Infinity;
    ramp.indices.forEach((idx, s) => {
      if (s === step || !count.has(idx)) return;
      const b = labOf(palette, idx);
      const d = Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
      if (d < bestD) { bestD = d; to = s; }
    });
    const toIdx = ramp.indices[to] ?? from;
    for (let k = 0; k < r.px.length; k++) if (r.px[k] === from) r.px[k] = toIdx;
    count.set(toIdx, (count.get(toIdx) ?? 0) + n);
    count.delete(from);
    merges.push({ material: ramp.id, from: step, to, pixels: n });
  }
  return { limit, before, after: count.size, merges };
}
