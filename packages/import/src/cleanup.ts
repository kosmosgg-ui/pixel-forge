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
    spill = lab.map((l) => Math.hypot(l.a, l.b) > 0.12 && Math.abs(Math.atan2(Math.sin(Math.atan2(l.b, l.a) - bh), Math.cos(Math.atan2(l.b, l.a) - bh))) < 0.5);
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

export function cleanupFramesInPlace(frames: readonly IndexFrame[], palette: readonly number[], o: { background: number | null; near?: number }): CleanupStats {
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
  const darkest = new Set(palette.map((c, i) => [labOf(c).L, i + 1] as const).sort((a, b) => a[0] - b[0]).slice(0, 2).map(([, i]) => i));
  const absorbed = frames.reduce((a, f) => a + absorbLones(f, darkest), 0);
  return { despilled, merged, absorbed };
}
