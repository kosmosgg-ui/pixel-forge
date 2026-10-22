import { binarizeAlphaInPlace, removeBackgroundInPlace } from './background.js';
import { dedupeRow, rowsByGap } from './rows.js';
import { segmentSprites } from './segment.js';
import type { RgbaImage } from './types.js';

export interface ProbeResult {
  sprites: number;
  rows: number;
  /** 줄마다 스프라이트 수 */
  perRow: number[];
  /** 키·폭 분포 [최소, 중앙, 최대] */
  height: [number, number, number];
  width: [number, number, number];
  /** 잘린 스프라이트(줄 우선 순번, 0부터) */
  clipped: number[];
  /** 잘린 스프라이트 번호 → 닿은 변 */
  clippedEdges: Record<number, string[]>;
  /** 줄마다 픽셀 완전 동일을 하나로 친 고유 프레임 수 합 */
  unique: number;
  /** 불투명 픽셀의 서로 다른 색 수 */
  colors: number;
  /** 원래 알파가 0·255가 아닌 픽셀 수(반투명 테두리) */
  semiAlpha: number;
}

const spread = (v: number[]): [number, number, number] => {
  const s = [...v].sort((a, b) => a - b);
  return [s[0] ?? 0, s[Math.floor(s.length / 2)] ?? 0, s[s.length - 1] ?? 0];
};

/** Spec 없이 분석만(Spec 작성 보조): 배경 처리·알파 이진화 → 분리 → 줄(간격) → 잘림·중복·색 수. 입력은 바꾸지 않는다 */
export function probeImage(src: RgbaImage, alphaThreshold = 128): ProbeResult {
  const img: RgbaImage = { w: src.w, h: src.h, rgba: src.rgba.slice() };
  let semi = 0;
  for (let k = 3; k < img.rgba.length; k += 4) { const a = img.rgba[k] ?? 0; if (a > 0 && a < 255) semi++; }
  removeBackgroundInPlace(img);
  binarizeAlphaInPlace(img, alphaThreshold);
  const rows = rowsByGap(segmentSprites(img));
  const flat = rows.flat();
  const colors = new Set<number>();
  for (let k = 0; k < img.rgba.length; k += 4) if (img.rgba[k + 3]) colors.add(((img.rgba[k] ?? 0) << 16) | ((img.rgba[k + 1] ?? 0) << 8) | (img.rgba[k + 2] ?? 0));
  return {
    sprites: flat.length, rows: rows.length, perRow: rows.map((r) => r.length),
    height: spread(flat.map((s) => s.h)), width: spread(flat.map((s) => s.w)),
    clipped: flat.flatMap((s, i) => (s.clipped ? [i] : [])),
    clippedEdges: Object.fromEntries(flat.flatMap((s, i) => (s.clipped ? [[i, s.edges ?? []]] : []))),
    unique: rows.reduce((a, r) => a + dedupeRow(r).unique.length, 0), colors: colors.size, semiAlpha: semi,
  };
}
