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
 * 사용 단계가 3개 이상인 재질에서 먼저 고른다 — 작은 파츠뿐인 재질(단검의 금속 등)이 한 색으로 뭉개져
 * 명암이 사라지지 않게. 그런 재질이 없을 때만 2단계 재질을 1단계로 줄인다.
 */
export function fitBudgetInPlace(rs: readonly IndexedRaster[], ramps: readonly Ramp[], palette: Palette, limit: number, exclude: ReadonlySet<number>): BudgetFitResult {
  // 애니 전 프레임을 함께 세고 같은 병합을 모두에 적용한다 — 프레임마다 색이 달라지면 깜빡인다
  const count = new Map<number, number>();
  for (const r of rs) for (const v of r.px) if (v) count.set(v, (count.get(v) ?? 0) + 1);
  const before = count.size;
  const merges: BudgetMerge[] = [];
  while (count.size > limit) {
    const pick = pickStep(ramps, count, exclude, 3) ?? pickStep(ramps, count, exclude, 2);
    if (!pick) break;
    const { ramp, step, n } = pick;
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
    for (const r of rs) for (let k = 0; k < r.px.length; k++) if (r.px[k] === from) r.px[k] = toIdx;
    count.set(toIdx, (count.get(toIdx) ?? 0) + n);
    count.delete(from);
    merges.push({ material: ramp.id, from: step, to, pixels: n });
  }
  return { limit, before, after: count.size, merges };
}

/** 사용 단계가 minUsed개 이상인 재질 중 가장 적게 쓰인 단계 */
interface Pick { ramp: Ramp; step: number; n: number }

function pickStep(ramps: readonly Ramp[], count: ReadonlyMap<number, number>, exclude: ReadonlySet<number>, minUsed: number): Pick | null {
  let pick: Pick | null = null;
  for (const ramp of ramps) {
    if (ramp.indices.filter((i) => count.has(i)).length < minUsed) continue;
    ramp.indices.forEach((idx, step) => {
      const n = count.get(idx);
      if (n === undefined || exclude.has(idx)) return;
      if (!pick || n < pick.n) pick = { ramp, step, n };
    });
  }
  return pick as Pick | null;
}
