/** 인덱스 프레임(칸마다 팔레트 순번 + 1, 0 = 투명) */
export interface IndexFrame {
  w: number;
  h: number;
  px: Uint8Array;
}

/**
 * 발 앵커: 가장 아래 불투명 줄의 불투명 칸 x 가운데 + 그 줄 y. bbox 가운데를 쓰지 않는 이유 —
 * 머리카락·망토가 흔들려도 몸(발)이 떨리지 않게(사용자 승인 P8 6단계).
 */
export function feetAnchor(f: IndexFrame): [number, number] {
  for (let y = f.h - 1; y >= 0; y--) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x]) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 >= 0) return [Math.floor((x0 + x1) / 2), y];
  }
  return [Math.floor(f.w / 2), f.h - 1];
}

/** 셀에 놓기: 발 앵커를 셀 앵커에 맞춘다. 셀 밖으로 나가는 칸 수를 함께 돌려준다(> 0이면 import.oversize — 축소하지 않는다) */
export function placeInCell(f: IndexFrame, cellW: number, cellH: number, anchor: readonly [number, number]): { frame: IndexFrame; outside: number } {
  const [fx, fy] = feetAnchor(f);
  const dx = anchor[0] - fx, dy = anchor[1] - fy;
  const px = new Uint8Array(cellW * cellH);
  let outside = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const v = f.px[y * f.w + x] ?? 0;
    if (!v) continue;
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= cellW || Y >= cellH) { outside++; continue; }
    px[Y * cellW + X] = v;
  }
  return { frame: { w: cellW, h: cellH, px }, outside };
}

/**
 * 외곽선 정리(사용자 승인 P8 7단계): 실루엣 바깥 둘레 칸의 70% 이상이 이미 어두운 색(명도 하위 2단계)이면 그대로,
 * 아니면 둘레 바깥 1px(4-이웃)을 외곽선 색으로. 반환 = 외곽선을 더했는지.
 */
export function outlineInPlace(f: IndexFrame, darkest: ReadonlySet<number>, outlineIndex: number, ratio = 0.7): boolean {
  const { w, h, px } = f;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (px[y * w + x] ?? 0) > 0;
  let ring = 0, dark = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!opaque(x, y) || (opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1))) continue;
    ring++;
    if (darkest.has(px[y * w + x] ?? 0)) dark++;
  }
  if (!ring || dark >= ring * ratio) return false;
  const add: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (opaque(x, y)) continue;
    if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) add.push(y * w + x);
  }
  for (const k of add) px[k] = outlineIndex;
  return true;
}
