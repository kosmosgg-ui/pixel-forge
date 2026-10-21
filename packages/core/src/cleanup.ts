import type { IndexedRaster } from './raster.js';
import type { ZoneBuffer } from './zone.js';

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

/** 가장 많은 값. 동률이면 작은 값 (결정론) */
function majority(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = -1, bestN = 0;
  for (const [v, n] of counts) if (n > bestN || (n === bestN && v < best)) { best = v; bestN = n; }
  return best;
}

/**
 * rule: form.cleanup — 8-이웃에 같은 색이 하나도 없는 픽셀을 이웃의 다수 색으로 바꾼다.
 * 칠해진 이웃이 없으면 투명. keep의 인덱스, protect가 1인 위치(외곽선 등)는 건드리지 않는다. 판정은 원본 기준이라 순서와 무관.
 */
export function removeOrphansInPlace(r: IndexedRaster, keep: ReadonlySet<number> = new Set(), protect?: Uint8Array): number {
  const changes: [number, number][] = [];
  const around: number[] = [];
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const k = y * r.w + x, v = r.px[k] ?? 0;
    if (v === 0 || keep.has(v) || protect?.[k]) continue;
    around.length = 0;
    for (const [dx, dy] of N8) {
      const X = x + dx, Y = y + dy, j = Y * r.w + X;
      if (X >= 0 && Y >= 0 && X < r.w && Y < r.h) around.push(r.px[j] ?? 0);
    }
    if (around.includes(v)) continue;
    const filled = around.filter((n) => n !== 0);
    changes.push([y * r.w + x, filled.length ? majority(filled) : 0]);
  }
  for (const [i, v] of changes) r.px[i] = v;
  return changes.length;
}

function labelShadeClusters(z: ZoneBuffer): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(z.w * z.h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < label.length; i++) {
    if (label[i] !== -1 || !z.material[i]) continue;
    const id = sizes.length;
    let n = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop() ?? 0;
      n++;
      const x = k % z.w, y = (k - x) / z.w;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy, j = Y * z.w + X;
        if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || label[j] !== -1) continue;
        if (z.material[j] !== z.material[k] || z.shade[j] !== z.shade[k] || z.part[j] !== z.part[k]) continue;
        label[j] = id;
        stack.push(j);
      }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/**
 * rule: form.cleanup — 같은 파츠·재질 안에서 크기 < minCluster인 shade 섬을 주변(같은 파츠·재질)의 최빈 shade로 병합.
 * 파츠 경계를 넘지 않는 이유: 움직이지 않는 파츠의 음영이 옆 파츠 움직임에 따라 바뀌면 애니에서 깜빡인다(anim.flicker).
 * 필로우 셰이딩·노이즈 방지. 반환값은 바뀐 픽셀 수.
 */
export function mergeSmallClustersInPlace(z: ZoneBuffer, minCluster: number): number {
  const { label, sizes } = labelShadeClusters(z);
  const target = new Map<number, number>();
  for (let i = 0; i < label.length; i++) {
    const id = label[i] ?? -1;
    if (id < 0 || (sizes[id] ?? 0) >= minCluster) continue;
    const x = i % z.w, y = (i - x) / z.w;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy, j = Y * z.w + X;
      if (X < 0 || Y < 0 || X >= z.w || Y >= z.h || label[j] === id || z.material[j] !== z.material[i] || z.part[j] !== z.part[i]) continue;
      target.set(id * 256 + (z.shade[j] ?? 0), (target.get(id * 256 + (z.shade[j] ?? 0)) ?? 0) + 1);
    }
  }
  const pick = new Map<number, number>();
  for (const [key, n] of target) {
    const id = Math.floor(key / 256), sh = key % 256, cur = pick.get(id);
    const curN = cur === undefined ? -1 : target.get(id * 256 + cur) ?? -1;
    if (n > curN || (n === curN && cur !== undefined && sh < cur)) pick.set(id, sh);
  }
  let changed = 0;
  for (let i = 0; i < label.length; i++) {
    const sh = pick.get(label[i] ?? -1);
    if (sh === undefined) continue;
    z.shade[i] = sh;
    changed++;
  }
  return changed;
}
