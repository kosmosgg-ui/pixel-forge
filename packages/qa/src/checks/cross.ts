import { check, type Check } from '../types.js';

/** 교차 검사 입력: 캐릭터 하나의 대표(rest) 프레임 불투명 마스크 */
export interface Silhouette {
  id: string;
  sizeClass: string;
  w: number;
  h: number;
  /** 1 = 불투명 */
  mask: Uint8Array;
}

/** 발밑 가운데: 가장 아래 불투명 줄의 가로 가운데 */
function bottomCenter(s: Silhouette): [number, number] {
  for (let y = s.h - 1; y >= 0; y--) {
    let minX = s.w, maxX = -1;
    for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (maxX >= 0) return [Math.floor((minX + maxX) / 2), y];
  }
  return [0, -1];
}

/** 발밑 가운데를 맞춰 겹친 실루엣 IoU */
export function silhouetteIoU(a: Silhouette, b: Silhouette): number {
  const [ax, ay] = bottomCenter(a), [bx, by] = bottomCenter(b);
  const dx = bx - ax, dy = by - ay;
  let inter = 0, union = 0;
  const w = Math.max(a.w, b.w) + Math.abs(dx), h = Math.max(a.h, b.h) + Math.abs(dy);
  for (let y = -Math.abs(dy); y < h; y++) for (let x = -Math.abs(dx); x < w; x++) {
    const va = x >= 0 && y >= 0 && x < a.w && y < a.h ? a.mask[y * a.w + x] ?? 0 : 0;
    const X = x + dx, Y = y + dy;
    const vb = X >= 0 && Y >= 0 && X < b.w && Y < b.h ? b.mask[Y * b.w + X] ?? 0 : 0;
    if (va && vb) inter++;
    if (va || vb) union++;
  }
  return union ? inter / union : 0;
}

const heightOf = (s: Silhouette): number => {
  let top = -1, bottom = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x]) { if (top < 0) top = y; bottom = y; }
  return top < 0 ? 0 : bottom - top + 1;
};

/** 캐릭터별 form.silhouette(같은 프로젝트 다른 캐릭터와의 최대 IoU ≤ max), scale.consistency(같은 sizeClass 키 중앙값 대비 ±tol) */
export function crossChecks(all: readonly Silhouette[], iouMax: number, tol: number): Map<string, Check[]> {
  const out = new Map<string, Check[]>();
  for (const s of all) {
    const others = all.filter((o) => o.id !== s.id);
    const iou = others.length ? Math.max(...others.map((o) => silhouetteIoU(s, o))) : 0;
    const peers = all.filter((o) => o.sizeClass === s.sizeClass).map(heightOf).sort((a, b) => a - b);
    const median = peers[Math.floor((peers.length - 1) / 2)] ?? 0;
    const dev = median ? Math.abs(heightOf(s) - median) / median : 0;
    out.set(s.id, [
      check('form.silhouette', false, iou <= iouMax, Math.round(iou * 1000) / 1000, iouMax),
      check('scale.consistency', false, dev <= tol, Math.round(dev * 1000) / 1000, tol),
    ]);
  }
  return out;
}
