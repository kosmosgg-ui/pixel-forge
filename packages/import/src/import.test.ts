import { describe, expect, it } from 'vitest';
import { feetAnchor, measureStride, placeInCell, seloutInPlace } from './align.js';
import { identityCheck, jitterCheck, paletteDeltaCheck } from './checks.js';
import { binarizeAlphaInPlace, removeBackgroundInPlace } from './background.js';
import { silhouetteMatch } from './match.js';
import { medianCut } from './palette.js';
import { importImage, type ImportOptions } from './pipeline.js';
import { probeImage } from './probe.js';
import { dedupeRow, rowsByGap } from './rows.js';
import { boxDownscale } from './scale.js';
import { segmentSprites } from './segment.js';
import type { RgbaImage } from './types.js';

/** w×h 캔버스(배경 bg, 기본 투명) */
function canvas(w: number, h: number, bg: [number, number, number, number] = [0, 0, 0, 0]): RgbaImage {
  const rgba = new Uint8Array(w * h * 4);
  for (let k = 0; k < w * h; k++) rgba.set(bg, k * 4);
  return { w, h, rgba };
}
function rect(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, c: [number, number, number, number]): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) img.rgba.set(c, (y * img.w + x) * 4);
}
/** 사람 모양 블록: 몸(빨강) + 발(검정 2px) — 발 x 가운데가 앵커 */
function figure(img: RgbaImage, x: number, y: number, h = 20): void {
  rect(img, x, y, x + 7, y + h - 3, [200, 40, 40, 255]);
  rect(img, x + 2, y + h - 2, x + 5, y + h - 1, [20, 20, 20, 255]);
}
const OPTS: ImportOptions = { rows: [{ anim: 'idle', dir: 's' }], cell: { w: 32, h: 32, anchor: [16, 30] }, alphaThreshold: 128, dedupe: true, background: 'auto', palette: { max: 8 } };

describe('import (합성 테스트 5종 + 흰 천)', () => {
  it('격자 어긋남: 칸(16px) 경계를 넘나드는 스프라이트도 연결 성분으로 하나씩, 왼쪽부터', () => {
    const img = canvas(64, 32);
    // 16px 칸 경계(16·32·48)를 넘나드는 위치, 서로 5px 이상 떨어짐(팽창 2px로 붙지 않게)
    figure(img, 3, 4); figure(img, 17, 6); figure(img, 41, 2);
    const s = segmentSprites(img);
    expect(s.map((x) => x.x).sort((a, b) => a - b)).toEqual([3, 17, 41]);
    expect(probeImage(img)).toMatchObject({ sprites: 3, rows: 1, clipped: [] });
  });

  it('반투명 테두리: 알파 < 기준은 투명, 결과 알파는 0·255만', () => {
    const img = canvas(16, 16);
    rect(img, 2, 2, 13, 13, [255, 255, 255, 100]);
    rect(img, 4, 4, 11, 11, [10, 120, 200, 255]);
    binarizeAlphaInPlace(img, 128);
    const alphas = new Set<number>();
    for (let k = 3; k < img.rgba.length; k += 4) alphas.add(img.rgba[k] ?? 0);
    expect([...alphas].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(segmentSprites(img)[0]).toMatchObject({ x: 4, y: 4, w: 8, h: 8 });
  });

  it('가장자리 잘림: 이미지 끝에 닿은 스프라이트 → clipped, import 경고 import.clipped', () => {
    const img = canvas(40, 24);
    figure(img, 2, 2); figure(img, 32, 2);
    expect(probeImage(img).clipped).toEqual([1]);
    const r = importImage(img, OPTS);
    expect(r.warnings).toEqual([expect.objectContaining({ id: 'import.clipped', note: expect.stringContaining('0:1') })]);
  });

  it('중복 프레임: 같은 줄의 픽셀 완전 동일 프레임은 하나로, 원래 순서는 frameMap', () => {
    const img = canvas(60, 24);
    figure(img, 2, 2); figure(img, 22, 2, 18); figure(img, 42, 2);
    const row = rowsByGap(segmentSprites(img))[0] ?? [];
    expect(dedupeRow(row)).toMatchObject({ frameMap: [0, 1, 0] });
    expect(dedupeRow(row).unique).toHaveLength(2);
    const r = importImage(img, OPTS);
    expect(r.frames).toHaveLength(2);
    expect(r.frameMap).toEqual({ idle_s: [0, 1, 0] });
  });

  it('흰 배경 + 흰 천 내부: 가장자리와 이어진 흰색만 투명, 외곽선 안쪽 흰 천은 남는다', () => {
    const img = canvas(24, 24, [255, 255, 255, 255]);
    rect(img, 4, 4, 19, 19, [30, 30, 40, 255]);
    rect(img, 6, 6, 17, 17, [250, 250, 250, 255]);
    removeBackgroundInPlace(img);
    const at = (x: number, y: number) => img.rgba[(y * 24 + x) * 4 + 3];
    expect([at(0, 0), at(2, 12)]).toEqual([0, 0]);
    expect([at(10, 10), at(4, 4)]).toEqual([255, 255]);
    expect(segmentSprites(img)).toHaveLength(1);
  });
});

describe('import 처리 단계', () => {
  it('BOX 축소(알파 사전곱): 불투명 안의 1px 선은 끊기지 않고 색이 섞여 남는다, 투명 칸 색은 섞이지 않는다', () => {
    const img = canvas(8, 8);
    rect(img, 0, 0, 7, 7, [200, 200, 200, 255]);
    rect(img, 3, 0, 3, 7, [0, 0, 0, 255]);
    const d = boxDownscale(img, 0.5);
    expect([d.w, d.h]).toEqual([4, 4]);
    expect(d.rgba[(0 * 4 + 1) * 4]).toBe(100);
    const t = canvas(4, 4);
    rect(t, 0, 0, 1, 3, [255, 0, 0, 255]);
    t.rgba.set([0, 255, 0, 0], (0 * 4 + 2) * 4);
    const e = boxDownscale(t, 0.5);
    expect(Array.from(e.rgba.subarray(0, 4))).toEqual([255, 0, 0, 255]);
  });

  it('공통 배율: 모든 프레임에 가장 큰 프레임 키 → targetHeight 하나의 배율(걷기 중 키가 출렁이지 않게)', () => {
    const img = canvas(60, 44);
    figure(img, 2, 2, 40); figure(img, 30, 22, 20);
    const r = importImage(img, { ...OPTS, cell: { w: 32, h: 32, anchor: [16, 30] }, targetHeight: 20 });
    expect(r.scale).toBeCloseTo(0.5);
    const tall = (i: number) => { const f = r.frames[i]?.frame; let n = 0; if (f) for (let y = 0; y < f.h; y++) if ([...f.px.subarray(y * f.w, (y + 1) * f.w)].some(Boolean)) n++; return n; };
    expect([tall(0), tall(1)]).toEqual([20, 10]);
  });

  it('발 앵커 정렬 + 셀보다 크면 축소하지 않고 import.oversize', () => {
    const f = { w: 6, h: 4, px: Uint8Array.from([0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0]) };
    expect(feetAnchor(f)).toEqual([2, 3]);
    const p = placeInCell(f, 8, 8, [4, 7]);
    expect([p.outside, p.frame.px[7 * 8 + 4]]).toEqual([0, 1]);
    const img = canvas(40, 40);
    figure(img, 4, 2, 36);
    expect(() => importImage(img, OPTS)).toThrow(expect.objectContaining({ code: 'import.oversize' }));
  });

  it('median-cut: max색 이하, 명도 오름차순, 같은 입력 → 같은 팔레트(결정론)', () => {
    const img = canvas(16, 1);
    for (let x = 0; x < 16; x++) img.rgba.set([x * 16, 255 - x * 16, 64, 255], x * 4);
    const a = medianCut([img], 4), b = medianCut([img], 4);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a).toEqual(b);
  });

  it('외곽선: 둘레가 이미 어둡지 않으면 1px 외곽선 색을 더한다', () => {
    const img = canvas(24, 24);
    rect(img, 8, 6, 15, 21, [220, 180, 60, 255]);
    const r = importImage(img, { ...OPTS, outline: 0x101010 });
    const f = r.frames[0]?.frame;
    const oi = r.palette.indexOf(0x101010) + 1;
    expect(oi).toBeGreaterThan(0);
    expect([...(f?.px ?? [])].filter((v) => v === oi).length).toBeGreaterThan(20);
  });

  it('외곽선을 더해도 키 = targetHeight, 맨 아래 줄 = 발 앵커 y(2px 작게 줄이고 1px 위에 놓는다), 모든 프레임에 같이', () => {
    const img = canvas(60, 44);
    rect(img, 4, 2, 15, 41, [220, 180, 60, 255]); rect(img, 34, 12, 45, 41, [220, 180, 60, 255]);
    const r = importImage(img, { ...OPTS, rows: [{ anim: 'idle', dir: 's' }], targetHeight: 20, outline: 0x101010 });
    const rowsOf = (i: number) => { const f = r.frames[i]?.frame; const ys: number[] = []; if (f) for (let y = 0; y < f.h; y++) if ([...f.px.subarray(y * f.w, (y + 1) * f.w)].some(Boolean)) ys.push(y); return ys; };
    expect([rowsOf(0).length, rowsOf(0).at(-1), rowsOf(1).at(-1)]).toEqual([20, 30, 30]);
    const oi = r.palette.indexOf(0x101010) + 1;
    expect(r.frames.every((f) => f.frame.px.includes(oi))).toBe(true);
  });
});

describe('import QA', () => {
  const base = (frames: { anim: string; dir: string; index: number; px: number[] }[], paletteDelta = 0.01) => ({
    palette: [0x202020, 0xc03030, 0x30c030], warnings: [], frameMap: {}, scale: 1, paletteDelta,
    frames: frames.map((f) => ({ anim: f.anim, dir: f.dir, index: f.index, source: { row: 0, sprite: f.index }, frame: { w: 4, h: 4, px: Uint8Array.from(f.px) } })),
  });
  const A = [0, 2, 2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 1, 1, 0], B = [0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 1, 1, 0], G = [0, 3, 3, 0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 1, 1, 0];
  it('palette-delta > 0.06 경고, jitter: idle 연속 프레임 몸 이동 > 1px 경고', () => {
    expect(paletteDeltaCheck(base([], 0.08)).pass).toBe(false);
    expect(jitterCheck(base([{ anim: 'idle', dir: 's', index: 0, px: A }, { anim: 'idle', dir: 's', index: 1, px: A }])).pass).toBe(true);
    const L = [2, 2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 1, 1, 0]; // 몸 무게중심 x 0.75 → B 2.25(1.5px)
    const j = jitterCheck(base([{ anim: 'idle', dir: 's', index: 0, px: A }, { anim: 'idle', dir: 's', index: 1, px: L }, { anim: 'idle', dir: 's', index: 2, px: B }]));
    expect(j).toMatchObject({ pass: false, note: expect.stringContaining('idle_s_1→2') });
  });
  it('identity: 한 프레임만 색 분포가 튀면 경고(AI 드리프트)', () => {
    const ok = identityCheck(base([0, 1, 2, 3].map((i) => ({ anim: 'walk', dir: 'e', index: i, px: A }))));
    expect(ok.pass).toBe(true);
    const bad = identityCheck(base([0, 1, 2].map((i) => ({ anim: 'walk', dir: 'e', index: i, px: A })).concat([{ anim: 'walk', dir: 'e', index: 3, px: G }])));
    expect(bad).toMatchObject({ pass: false, note: expect.stringContaining('walk_e_3') });
  });
});

describe('import layout row', () => {
  it('한 이미지 줄에 애니 둘(row 번호 지정): idle 0~1 + run 2, 줄 수 = row 최댓값 + 1', () => {
    const img = canvas(80, 24);
    figure(img, 2, 2); figure(img, 22, 2, 18); figure(img, 42, 2, 16);
    const r = importImage(img, { ...OPTS, rows: [{ anim: 'idle', dir: 's', row: 0, frames: [0, 1] }, { anim: 'run', dir: 's', row: 0, frames: [2] }] });
    expect(r.frames.map((f) => `${f.anim}_${f.index}:${f.source.sprite}`)).toEqual(['idle_0:0', 'idle_1:1', 'run_0:2']);
  });
});

describe('import 배경 #00FF00 (P8fix 4 — GPT 원본 기본 배경)', () => {
  it('초록 배경 + 가장자리 번진 초록은 투명, 캐릭터 안 연두색은 남는다 / 마젠타 배경도 같은 규칙', () => {
    for (const bg of [[0, 255, 0, 255], [255, 0, 255, 255]] as [number, number, number, number][]) {
      const img = canvas(24, 24, bg);
      rect(img, 3, 3, 20, 20, [bg[0] ? 245 : 10, bg[1] ? 240 : 12, bg[2] ? 238 : 14, 255]); // 배경색에 가까운 번짐 1px 테두리
      rect(img, 4, 4, 19, 19, [30, 30, 40, 255]);
      rect(img, 6, 6, 17, 17, [120, 200, 40, 255]);
      removeBackgroundInPlace(img);
      const at = (x: number, y: number) => img.rgba[(y * 24 + x) * 4 + 3];
      expect([at(0, 0), at(12, 0), at(3, 12)]).toEqual([0, 0, 0]);
      expect([at(10, 10), at(4, 4)]).toEqual([255, 255]);
    }
  });
});

describe('재현성 측정(P8fix 1)', () => {
  it('발 기준 정렬: 같은 그림을 옆으로 옮겨도 IoU 1·ΔE 0, 반쪽만 겹치면 IoU < 1', () => {
    const a = canvas(32, 32), b = canvas(32, 32), c = canvas(32, 32);
    figure(a, 4, 6); figure(b, 18, 7); rect(c, 18, 7, 21, 26, [200, 40, 40, 255]); rect(c, 20, 25, 23, 26, [20, 20, 20, 255]);
    expect(silhouetteMatch(a, b)).toMatchObject({ iou: 1, deltaE: 0, offset: [-14, -1] });
    expect(silhouetteMatch(a, c).iou).toBeLessThan(0.7);
  });
});

describe('걷기 보폭 실측(P10 0절)', () => {
  it('접지 프레임 앞발·뒷발 가운데 거리 평균: 11·13 → 12, 발이 붙은 프레임은 뺀다', () => {
    const f = (gap: number) => { const px = new Uint8Array(32 * 10); for (let y = 0; y < 7; y++) px[y * 32 + 10] = 1; for (const x of [4, 4 + gap - 1]) for (let y = 7; y < 10; y++) { px[y * 32 + x] = 1; px[y * 32 + x + 1] = 1; } return { w: 32, h: 10, px }; };
    expect(measureStride([f(12), f(14)])).toBe(12);
    expect(measureStride([f(12), f(2)])).toBe(11);
    const tip = f(12); tip.px[9 * 32 + 0] = 1;
    expect(measureStride([tip])).toBe(11);
    expect(measureStride([])).toBe(0);
  });
});

describe('선택 외곽선(P10 1절)', () => {
  it('바깥 경계만 어두운 짝으로, 안쪽·실루엣 크기는 그대로', () => {
    const f = { w: 5, h: 5, px: new Uint8Array(25) };
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) f.px[y * 5 + x] = 2;
    seloutInPlace(f, [1, 1]);
    expect(f.px[2 * 5 + 2]).toBe(2);
    expect([f.px[1 * 5 + 1], f.px[1 * 5 + 2], f.px[3 * 5 + 3]]).toEqual([1, 1, 1]);
    expect([...f.px].filter(Boolean)).toHaveLength(9);
  });
  it('importImage selout: 키 = targetHeight 그대로, 경계는 더 어두운 색', () => {
    const img = canvas(24, 24);
    rect(img, 8, 2, 15, 21, [220, 180, 60, 255]); rect(img, 10, 5, 13, 18, [120, 90, 30, 255]);
    const r = importImage(img, { ...OPTS, targetHeight: 20, outline: 0x101010, outlineMode: 'selout' });
    const f = r.frames[0]?.frame;
    const rows = f ? [...Array(f.h).keys()].filter((y) => [...f.px.subarray(y * f.w, (y + 1) * f.w)].some(Boolean)) : [];
    expect(rows.length).toBe(20);
  });
});

