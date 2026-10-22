import type { Sprite } from './types.js';

const cy = (s: Sprite) => s.y + s.h / 2;

/**
 * 줄 나누기: 세로 중심의 1차원 k-means(k = layout 줄 수). 초기값 = 중심을 정렬해 k등분한 위치(결정론).
 * 줄 안은 왼쪽부터(x) 정렬.
 */
export function rowsByKmeans(sprites: readonly Sprite[], k: number): Sprite[][] {
  const ys = sprites.map(cy).sort((a, b) => a - b);
  let cent = Array.from({ length: k }, (_, i) => ys[Math.min(ys.length - 1, Math.floor(((i + 0.5) * ys.length) / k))] ?? 0);
  let assign: number[] = [];
  for (let it = 0; it < 32; it++) {
    assign = sprites.map((s) => { const y = cy(s); let b = 0; cent.forEach((c, i) => { if (Math.abs(y - c) < Math.abs(y - (cent[b] ?? 0))) b = i; }); return b; });
    const next = cent.map((c, i) => { const m = sprites.filter((_, j) => assign[j] === i).map(cy); return m.length ? m.reduce((a, b) => a + b, 0) / m.length : c; });
    if (next.every((c, i) => c === cent[i])) break;
    cent = next;
  }
  const order = cent.map((c, i) => [c, i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  return order.map((i) => sprites.filter((_, j) => assign[j] === i).sort((a, b) => a.x - b.x || a.y - b.y));
}

/** 줄 수를 모를 때(--probe): 세로 중심을 정렬해 간격이 중앙 키의 절반보다 크면 새 줄 */
export function rowsByGap(sprites: readonly Sprite[]): Sprite[][] {
  if (!sprites.length) return [];
  const hs = sprites.map((s) => s.h).sort((a, b) => a - b);
  const med = hs[Math.floor(hs.length / 2)] ?? 1;
  const sorted = [...sprites].sort((a, b) => cy(a) - cy(b));
  const rows: Sprite[][] = [[]];
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    if (prev && cy(s) - cy(prev) > med / 2) rows.push([]);
    rows[rows.length - 1]?.push(s);
  });
  return rows.map((r) => r.sort((a, b) => a.x - b.x || a.y - b.y));
}

/** 같은 줄의 픽셀 완전 동일 스프라이트 → 첫 번째로. frameMap[i] = i번째 원래 프레임이 가리키는 고유 프레임 순번 */
export function dedupeRow(row: readonly Sprite[]): { unique: Sprite[]; frameMap: number[] } {
  const unique: Sprite[] = [], frameMap: number[] = [];
  for (const s of row) {
    const at = unique.findIndex((u) => u.w === s.w && u.h === s.h && sameBytes(u.img.rgba, s.img.rgba));
    if (at >= 0) frameMap.push(at);
    else { frameMap.push(unique.length); unique.push(s); }
  }
  return { unique, frameMap };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
