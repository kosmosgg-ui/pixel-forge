import { srgbToOklab } from '@pixel-forge/core';
import type { IndexFrame } from './align.js';

/**
 * import 정리 개선(P10 2.4 — pxl study 진단: 외톨이 24%·붙은 단계·초록 배경 잔여). 순수 함수, 팔레트는 그대로 두고 칸만 바꾼다.
 * 1) 배경 색조 잔여(despill): 배경과 같은 색조·채도 높은 팔레트 색 → 가장 가까운 다른 색
 * 2) 붙은 단계 병합: OKLab 거리 < near인 색 쌍 → 많이 쓰인 쪽으로
 * 3) 외톨이 흡수: 4-이웃에 같은 색이 없는 안쪽 칸 → 8-이웃 다수색. 실루엣 경계(외곽선)·가장 어두운 2색(선·눈)은 보호
 */
export interface CleanupStats { despilled: number; merged: number; absorbed: number }

const labOf = (c: number) => srgbToOklab(c >> 16, (c >> 8) & 255, c & 255);
const dist = (a: ReturnType<typeof labOf>, b: ReturnType<typeof labOf>) => Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);

/** 팔레트 색 → 대체 색(인덱스 1부터, 자기 자신 = 그대로) */
function remapTable(palette: readonly number[], counts: readonly number[], bg: number | null, near: number): { map: number[]; spill: boolean[] } {
  const lab = palette.map(labOf);
  const map = palette.map((_, i) => i + 1);
  let spill = palette.map(() => false);
  if (bg !== null) {
    const b = labOf(bg), bh = Math.atan2(b.b, b.a);
    // 진한 초록(채도 > 0.12, 0.5rad) + 어두운 선과 섞인 탁한 초록(채도 > 0.06, 0.6rad — #274c1a 같은 색, G2 U1 death 실측)
    spill = lab.map((l) => { const c = Math.hypot(l.a, l.b), d = Math.abs(Math.atan2(Math.sin(Math.atan2(l.b, l.a) - bh), Math.cos(Math.atan2(l.b, l.a) - bh))); return (c > 0.12 && d < 0.5) || (c > 0.06 && d < 0.6); });
    lab.forEach((l, i) => {
      if (!spill[i]) return;
      let best = -1, bd = Infinity;
      lab.forEach((q, j) => { if (!spill[j] && dist(l, q) < bd) { bd = dist(l, q); best = j; } });
      if (best >= 0) map[i] = best + 1;
    });
  }
  lab.forEach((l, i) => lab.forEach((q, j) => {
    if (i >= j || map[i] !== i + 1 || map[j] !== j + 1 || dist(l, q) >= near) return;
    if ((counts[i] ?? 0) >= (counts[j] ?? 0)) map[j] = i + 1; else map[i] = j + 1;
  }));
  return { map, spill };
}

function absorbLones(f: IndexFrame, protect: ReadonlySet<number>): number {
  const { w, h, px } = f, at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? px[y * w + x] ?? 0 : 0);
  const changes: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = at(x, y);
    if (!v || protect.has(v)) continue;
    const n4 = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
    if (n4.includes(0) || n4.includes(v)) continue;
    const votes = new Map<number, number>();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = at(x + dx, y + dy); if ((dx || dy) && n && n !== v) votes.set(n, (votes.get(n) ?? 0) + 1); }
    const [best, n] = [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [0, 0];
    if (best && n >= 4) changes.push([y * w + x, best]);
  }
  for (const [k, c] of changes) px[k] = c;
  return changes.length;
}

/**
 * 가장자리 배경 번짐 제거: 실루엣 바깥 경계(투명 4-이웃이 있는) 픽셀 중 배경 색조에 가까운 색(채도 > 0.06, 색상 차 < 0.6rad — 금색·크림은 0.9rad 밖)은 투명으로.
 * 작게 잘린 원본(보드에서 자른 death 등)은 초록이 다른 색과 섞인 번짐이 남는다(G2 U1 art-judge 관찰). 경계만 보므로 안쪽 색은 건드리지 않는다.
 */
function dropEdgeSpill(f: IndexFrame, greenish: readonly boolean[]): number {
  const { w, h, px } = f;
  const clear = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || !px[y * w + x];
  const hits: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = px[y * w + x] ?? 0;
    if (v && greenish[v - 1] && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1))) hits.push(y * w + x);
  }
  for (const k of hits) px[k] = 0;
  return hits.length;
}

/** HSV 색상(도)·채도·명도 */
function hsv(c: number): [number, number, number] {
  const r = (c >> 16) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = d === 0 ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, mx === 0 ? 0 : d / mx, mx];
}

/**
 * 잡티 흡수(G2 U3 분홍 점): drop 색 픽셀을 3×3 이웃의 다수색(drop·투명 제외)으로. 두 번 돌려 2px 덩어리까지. 이웃이 없으면 투명.
 */
function absorbColors(f: IndexFrame, drop: readonly boolean[]): number {
  const { w, h, px } = f;
  let n = 0;
  for (let pass = 0; pass < 2; pass++) {
    const next = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = px[y * w + x] ?? 0;
      if (!v || !drop[v - 1]) continue;
      const votes = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const q = x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h ? px[(y + dy) * w + x + dx] ?? 0 : 0;
        if (q && !drop[q - 1]) votes.set(q, (votes.get(q) ?? 0) + 1);
      }
      const best = [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      next[y * w + x] = pass === 1 && !best ? 0 : best?.[0] ?? v;
      if (best || pass === 1) n++;
    }
    px.set(next);
  }
  return n;
}

/** 붉은 기(피 얼룩) → 가장 가까운 명도의 무채색(금속) 팔레트 색. 무채색이 없으면 그대로 */
function redToMetalMap(palette: readonly number[]): number[] {
  const lab = palette.map(labOf);
  const grey = lab.flatMap((l, i) => (Math.hypot(l.a, l.b) < 0.04 ? [i] : []));
  return palette.map((c, i) => {
    const [h, sat] = hsv(c);
    if (!((h >= 345 || h <= 15) && sat > 0.35) || !grey.length) return i + 1;
    const g = grey.reduce((a, b) => (Math.abs((lab[b]?.L ?? 0) - (lab[i]?.L ?? 0)) < Math.abs((lab[a]?.L ?? 0) - (lab[i]?.L ?? 0)) ? b : a));
    return g + 1;
  });
}

export function cleanupFramesInPlace(frames: readonly IndexFrame[], palette: readonly number[], o: { background: number | null; near?: number; dropHue?: readonly [number, number]; redToMetal?: boolean }): CleanupStats {
  const counts = palette.map(() => 0);
  for (const f of frames) for (const v of f.px) if (v) counts[v - 1] = (counts[v - 1] ?? 0) + 1;
  const { map, spill } = remapTable(palette, counts, o.background, o.near ?? 0.05);
  let despilled = 0, merged = 0;
  for (const f of frames) for (let k = 0; k < f.px.length; k++) {
    const v = f.px[k] ?? 0, m = v ? map[v - 1] ?? v : 0;
    if (m === v) continue;
    f.px[k] = m;
    if (spill[v - 1]) despilled++; else merged++;
  }
  if (o.background !== null) {
    const b = labOf(o.background), bh = Math.atan2(b.b, b.a);
    const greenish = palette.map((c) => { const l = labOf(c), d = Math.atan2(l.b, l.a) - bh; return Math.hypot(l.a, l.b) > 0.06 && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.6; });
    for (const f of frames) despilled += dropEdgeSpill(f, greenish);
  }
  if (o.dropHue) {
    const [lo, hi] = o.dropHue;
    const drop = palette.map((c) => { const [h, sat, v] = hsv(c); return h >= lo && h <= hi && sat > 0.25 && v > 0.3; });
    if (drop.some(Boolean)) for (const f of frames) merged += absorbColors(f, drop);
  }
  if (o.redToMetal) {
    const m = redToMetalMap(palette);
    for (const f of frames) for (let k = 0; k < f.px.length; k++) { const v = f.px[k] ?? 0; if (v && m[v - 1] !== v) { f.px[k] = m[v - 1] ?? v; merged++; } }
  }
  const darkest = new Set(palette.map((c, i) => [labOf(c).L, i + 1] as const).sort((a, b) => a[0] - b[0]).slice(0, 2).map(([, i]) => i));
  const absorbed = frames.reduce((a, f) => a + absorbLones(f, darkest), 0);
  return { despilled, merged, absorbed };
}
