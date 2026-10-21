import { oklabToOklch, srgbToOklab, type IndexedRaster, type Palette } from '@pixel-forge/core';

export interface RefRamp {
  /** 어두운 → 밝은 순 #rrggbb */
  colors: string[];
  /** 가장 어두운 색 → 가장 밝은 색 hue 이동(도, 최단 각, 부호 = 회전 방향). 무채색 램프는 0 */
  hueShiftDeg: number;
  lRange: [number, number];
}

export interface RefMeasure {
  canvas: [number, number];
  /** 불투명 픽셀 경계 상자 [x, y, w, h] */
  silhouette: { bbox: [number, number, number, number]; heightPx: number; widthPx: number; opaque: number };
  uniqueColors: number;
  ramps: RefRamp[];
  outline: { type: 'dark' | 'selout' | 'none'; darkFraction: number; seloutFraction: number };
  /** 머리 높이 ÷ 키 — 위쪽 절반에서 실루엣 폭이 가장 좁은 줄(목)까지를 머리로 본다 */
  headRatio: number;
}

/** 무채색 기준 채도, 같은 램프로 묶는 hue 차 — 도트 램프는 hue를 조금씩 돌리므로 넉넉히 */
const NEUTRAL_C = 0.03;
const SAME_RAMP_HUE = 35;
const DARK_L = 0.3;

const hex = (c: number) => '#' + (c >>> 8).toString(16).padStart(6, '0');
const hueDiff = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
const lchOf = (c: number) => oklabToOklch(srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255));

/** 레퍼런스 스프라이트 1장 측정(§ P6). 입력은 io에서 인덱스화한 래스터(0 = 투명) */
export function analyzeRef(r: IndexedRaster, p: Palette): RefMeasure {
  let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1, opaque = 0;
  const used = new Set<number>();
  for (let k = 0; k < r.px.length; k++) {
    const v = r.px[k] ?? 0;
    if (!v) continue;
    used.add(v);
    opaque++;
    const x = k % r.w, y = (k - x) / r.w;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const w = x1 >= 0 ? x1 - x0 + 1 : 0, h = y1 >= 0 ? y1 - y0 + 1 : 0;
  return {
    canvas: [r.w, r.h],
    silhouette: { bbox: [Math.max(0, x0), Math.max(0, y0), w, h], heightPx: h, widthPx: w, opaque },
    uniqueColors: used.size,
    ramps: rampsOf([...used].sort((a, b) => a - b).map((i) => p.colors[i] ?? 0)),
    outline: outlineOf(r, p),
    headRatio: h ? headRatioOf(r, y0, y1) : 0,
  };
}

/** hue가 가까운 유채색끼리, 무채색끼리 묶어 명도순 램프로(union-find, 입력 순서 고정 → 결정론) */
function rampsOf(colors: readonly number[]): RefRamp[] {
  const lch = colors.map(lchOf);
  const parent = colors.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] ?? i)));
  for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) {
    const a = lch[i], b = lch[j];
    if (!a || !b) continue;
    const neutral = a.C < NEUTRAL_C && b.C < NEUTRAL_C;
    const chromatic = a.C >= NEUTRAL_C && b.C >= NEUTRAL_C && Math.abs(hueDiff(a.h, b.h)) <= SAME_RAMP_HUE;
    if (neutral || chromatic) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  colors.forEach((_, i) => { const g = find(i); groups.set(g, [...(groups.get(g) ?? []), i]); });
  return [...groups.values()].map((idx) => {
    const sorted = [...idx].sort((a, b) => (lch[a]?.L ?? 0) - (lch[b]?.L ?? 0) || a - b);
    const dark = lch[sorted[0] ?? 0], light = lch[sorted[sorted.length - 1] ?? 0];
    const shift = dark && light && dark.C >= NEUTRAL_C && light.C >= NEUTRAL_C ? hueDiff(dark.h, light.h) : 0;
    return {
      colors: sorted.map((i) => hex(colors[i] ?? 0)), hueShiftDeg: Math.round(shift),
      lRange: [round(dark?.L ?? 0), round(light?.L ?? 0)] as [number, number],
    };
  }).sort((a, b) => b.colors.length - a.colors.length || (a.colors[0] ?? '').localeCompare(b.colors[0] ?? ''));
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

/**
 * 외곽선 유형: 실루엣 테두리(투명과 4-이웃인 불투명 픽셀) 중
 * - 어두운(L < 0.3) 비율 ≥ 0.8이고 어두운 색이 2개 이하 → dark(검정·단색 외곽선)
 * - 안쪽 이웃보다 0.05 이상 어두운 비율 ≥ 0.6 → selout(색 따라 바뀌는 외곽선)
 * - 그 밖 → none
 */
function outlineOf(r: IndexedRaster, p: Palette): RefMeasure['outline'] {
  const L = (v: number) => lchOf(p.colors[v] ?? 0).L;
  let border = 0, dark = 0, darker = 0;
  const darkColors = new Set<number>();
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const v = r.px[y * r.w + x] ?? 0;
    if (!v) continue;
    const at = (X: number, Y: number) => (X < 0 || Y < 0 || X >= r.w || Y >= r.h ? 0 : r.px[Y * r.w + X] ?? 0);
    if (!N4.some(([dx, dy]) => !at(x + dx, y + dy))) continue;
    border++;
    const l = L(v);
    if (l < DARK_L) { dark++; darkColors.add(v); }
    // 안쪽 = 투명 이웃의 반대편
    const inner = N4.map(([dx, dy]) => (!at(x + dx, y + dy) ? at(x - dx, y - dy) : 0)).find((u) => u > 0);
    if (inner !== undefined && L(inner) - l >= 0.05) darker++;
  }
  const darkFraction = border ? round(dark / border) : 0, seloutFraction = border ? round(darker / border) : 0;
  const type = darkFraction >= 0.8 && darkColors.size <= 2 ? 'dark' : seloutFraction >= 0.6 ? 'selout' : 'none';
  return { type, darkFraction, seloutFraction };
}

function headRatioOf(r: IndexedRaster, y0: number, y1: number): number {
  const h = y1 - y0 + 1;
  const width = (y: number) => { let a = -1, b = -1; for (let x = 0; x < r.w; x++) if (r.px[y * r.w + x]) { if (a < 0) a = x; b = x; } return a < 0 ? 0 : b - a + 1; };
  // 머리 아래(위에서 15% 지점부터 절반까지)에서 폭이 가장 좁은 줄 = 목
  let neck = -1, best = Infinity;
  for (let y = y0 + Math.max(2, Math.floor(h * 0.15)); y <= y0 + Math.floor(h * 0.5); y++) {
    const wy = width(y);
    if (wy > 0 && wy < best) { best = wy; neck = y; }
  }
  return neck < 0 ? 0 : round((neck - y0) / h);
}
