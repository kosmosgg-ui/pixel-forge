/** 인덱스 프레임(칸마다 팔레트 순번 + 1, 0 = 투명) */
export interface IndexFrame {
  w: number;
  h: number;
  px: Uint8Array;
}

/** 발 띠 높이(줄): 걷기에서 한 발만 바닥에 닿아도 두 발을 함께 보게 */
const FEET_BAND = 3;

/**
 * 발 앵커: 가장 아래 불투명 줄 y + 그 위 FEET_BAND줄(발 띠)의 불투명 칸 x 범위 가운데. bbox 가운데를 쓰지 않는 이유 —
 * 머리카락·망토가 흔들려도 몸(발)이 떨리지 않게(사용자 승인 P8 6단계). 맨 아래 한 줄만 보면 걷기 접지 프레임에서
 * 앞발(또는 뒷발) 하나에 앵커가 붙어 몸이 셀 밖으로 밀린다(P10 0절 세라 48px 걷기 실측) — 그래서 띠를 본다.
 */
export function feetAnchor(f: IndexFrame): [number, number] {
  let bottom = -1;
  for (let y = f.h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x]) { bottom = y; break; }
  if (bottom < 0) return [Math.floor(f.w / 2), f.h - 1];
  let x0 = -1, x1 = -1;
  for (let y = Math.max(0, bottom - FEET_BAND + 1); y <= bottom; y++) for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x]) { if (x0 < 0 || x < x0) x0 = x; if (x > x1) x1 = x; }
  return [Math.floor((x0 + x1) / 2), bottom];
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

/** 실루엣 둘레(4-이웃 중 투명이 있는 불투명 칸) 수와 그중 어두운 색(darkest) 수 */
export function ringStats(f: IndexFrame, darkest: ReadonlySet<number>): { ring: number; dark: number } {
  const { w, h, px } = f;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (px[y * w + x] ?? 0) > 0;
  let ring = 0, dark = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!opaque(x, y) || (opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1))) continue;
    ring++;
    if (darkest.has(px[y * w + x] ?? 0)) dark++;
  }
  return { ring, dark };
}

/** 실루엣 바깥 4-이웃 1px 외곽선(색 outlineIndex) */
export function outlineInPlace(f: IndexFrame, outlineIndex: number): void {
  const { w, h, px } = f;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (px[y * w + x] ?? 0) > 0;
  const add: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (opaque(x, y)) continue;
    if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) add.push(y * w + x);
  }
  for (const k of add) px[k] = outlineIndex;
}

/**
 * 걷기 보폭(1배 px): 접지 프레임마다 발 띠(가장 아래 불투명 줄에서 위로 band줄)에서 불투명 열이 끊긴 덩어리(발)를 찾아
 * 가장 넓은 두 덩어리(두 발 — 낮게 든 칼끝·망토 끝 같은 가는 조각은 뺀다)의 가운데 사이 거리, 평균(반올림). 발이 붙어 덩어리가 하나면 그 프레임은 뺀다.
 * 게임이 걷기 재생 속도를 이동 속도에 맞출 때 쓴다(G1 3.3b). 잴 프레임이 없으면 0.
 */
export function measureStride(contacts: readonly IndexFrame[], band = 3): number {
  const gaps = contacts.flatMap((f) => {
    let bottom = -1;
    for (let k = f.px.length - 1; k >= 0 && bottom < 0; k--) if (f.px[k]) bottom = Math.floor(k / f.w);
    if (bottom < 0) return [];
    const runs: [number, number][] = [];
    for (let x = 0; x < f.w; x++) {
      let on = false;
      for (let y = Math.max(0, bottom - band + 1); y <= bottom && !on; y++) on = (f.px[y * f.w + x] ?? 0) > 0;
      const last = runs[runs.length - 1];
      if (on && last && last[1] === x - 1) last[1] = x;
      else if (on) runs.push([x, x]);
    }
    const [a, b] = [...runs].sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]) || p[0] - q[0]).slice(0, 2);
    return a && b ? [Math.abs((b[0] + b[1]) / 2 - (a[0] + a[1]) / 2)] : [];
  });
  return gaps.length ? Math.round(gaps.reduce((x, y) => x + y, 0) / gaps.length) : 0;
}

/**
 * 선택 외곽선(selout): 실루엣 바깥 경계(4-이웃에 투명이 있는 불투명 칸)를 같은 색 계열의 더 어두운 팔레트 색으로 바꾼다.
 * 실루엣을 키우지 않아 키·발 앵커가 그대로다. darker[i] = 팔레트 i+1번 색의 어두운 짝(인덱스, 1부터) — 호출자가 계산.
 */
export function seloutInPlace(f: IndexFrame, darker: readonly number[]): void {
  const { w, h, px } = f;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (px[y * w + x] ?? 0) > 0;
  const edge: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (opaque(x, y) && !(opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1))) edge.push(y * w + x);
  }
  for (const k of edge) px[k] = darker[(px[k] ?? 1) - 1] ?? px[k] ?? 0;
}

/**
 * 머리 폭(1배 px): 실루엣 위쪽 1/6(머리카락+얼굴 덩어리) 안에서 가장 넓은 줄의 폭. 동작마다 원본 크기가 달라
 * 머리 크기가 어긋났는지 보는 지표(G2 U1 anim.scale-consistency). 빈 프레임이면 0.
 */
export function headWidth(f: IndexFrame): number {
  let y0 = -1, y1 = -1;
  for (let k = 0; k < f.px.length; k++) if (f.px[k]) { const y = Math.floor(k / f.w); if (y0 < 0) y0 = y; y1 = y; }
  if (y0 < 0) return 0;
  const band = Math.max(1, Math.round((y1 - y0 + 1) / 6));
  let best = 0;
  for (let y = y0; y < y0 + band; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) best = Math.max(best, b - a + 1);
  }
  return best;
}
