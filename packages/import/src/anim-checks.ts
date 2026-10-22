import type { IndexFrame } from './align.js';
import type { ImportCheck } from './checks.js';
import type { ImportResult } from './pipeline.js';
import { srgbToOklab } from '@pixel-forge/core';

/** 원래 재생 순서의 프레임(dedupe 전 frameMap 순서) — 걷기 검사는 재생 순서로 본다 */
function playOrder(r: ImportResult, anim: string): { dir: string; frames: IndexFrame[] }[] {
  return Object.entries(r.frameMap).flatMap(([key, order]) => {
    const fs = r.frames.filter((f) => `${f.anim}_${f.dir}` === key).sort((a, b) => a.index - b.index);
    const first = fs[0];
    if (!first || first.anim !== anim) return [];
    return [{ dir: first.dir, frames: order.flatMap((u) => { const f = fs[u]; return f ? [f.frame] : []; }) }];
  });
}

const topRow = (f: IndexFrame) => { for (let k = 0; k < f.px.length; k++) if (f.px[k]) return Math.floor(k / f.w); return -1; };

/** rule: anim.head-bob — 걷기 머리 꼭대기 y 변화(1배). 48px 기준 3px 이하 정상, 4px 이상 경고(P10 1절, 실측 채택본 3·비교본 5) */
export function headBobCheck(r: ImportResult, warnAt = 4): ImportCheck {
  let worst = 0, at = '';
  for (const { dir, frames } of playOrder(r, 'walk')) {
    const ys = frames.map(topRow).filter((y) => y >= 0);
    const v = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    if (v > worst) { worst = v; at = dir; }
  }
  return { id: 'anim.head-bob', pass: worst < warnAt, value: worst, threshold: warnAt - 1, ...(worst >= warnAt ? { note: `walk_${at} 머리 흔들림 ${worst}px` } : {}) };
}

/** 발 띠(아래 band줄)의 불투명 열 덩어리 [x0, x1]과 각 덩어리의 가장 아래 y */
function feetRuns(f: IndexFrame, band = 3): { x0: number; x1: number; bottom: number }[] {
  let bottom = -1;
  for (let k = f.px.length - 1; k >= 0 && bottom < 0; k--) if (f.px[k]) bottom = Math.floor(k / f.w);
  const runs: { x0: number; x1: number; bottom: number }[] = [];
  for (let x = 0; x < f.w; x++) {
    let low = -1;
    for (let y = Math.max(0, bottom - band + 1); y <= bottom; y++) if (f.px[y * f.w + x]) low = y;
    const last = runs[runs.length - 1];
    if (low < 0) continue;
    if (last && last.x1 === x - 1) { last.x1 = x; last.bottom = Math.max(last.bottom, low); } else runs.push({ x0: x, x1: x, bottom: low });
  }
  return runs;
}

/** rule: anim.foot-contact — 걷기 접지 프레임(재생 1·4번)에서 앞발(옆 방향 = 오른쪽 덩어리) 최하단이 발 앵커 행에 닿는가 */
export function footContactCheck(r: ImportResult, anchorY: number, contacts: readonly number[] = [0, 3]): ImportCheck {
  const miss: string[] = [];
  let worst = 0;
  for (const { dir, frames } of playOrder(r, 'walk')) for (const i of contacts) {
    const f = frames[i];
    const front = f ? feetRuns(f).at(-1) : undefined;
    if (!front) continue;
    const gap = anchorY - front.bottom;
    if (gap > 0) { miss.push(`walk_${dir}_${i}(${gap}px 뜸)`); worst = Math.max(worst, gap); }
  }
  return { id: 'anim.foot-contact', pass: miss.length === 0, value: worst, threshold: 0, ...(miss.length ? { note: `접지 프레임 앞발이 바닥에 안 닿음: ${miss.join(', ')}` } : {}) };
}

/**
 * rule: form.weapon-separation — 무기 색 픽셀 중 4-이웃이 모두 불투명(실루엣 안쪽 — 몸에 겹쳐 바깥 윤곽을 만들지 못함)인 비율 > 60%면 경고(검이 몸에 묻힘).
 * 무기 색은 바이블 재질 metal_blade(없으면 판정하지 않고 value null — 색을 지어내지 않는다).
 */
export function weaponSeparationCheck(r: ImportResult, weapon: number | null, maxRatio = 0.6): ImportCheck {
  if (weapon === null) return { id: 'form.weapon-separation', pass: true, value: null, threshold: maxRatio, note: '바이블에 metal_blade 재질 없음 — 판정 생략(제안서 참고)' };
  const w = srgbToOklab(weapon >> 16, (weapon >> 8) & 255, weapon & 255);
  const isWeapon = r.palette.map((c) => { const p = srgbToOklab(c >> 16, (c >> 8) & 255, c & 255); return Math.hypot(p.L - w.L, p.a - w.a, p.b - w.b) < 0.08; });
  let total = 0, buried = 0;
  for (const { frame: f } of r.frames) for (let k = 0; k < f.px.length; k++) {
    const v = f.px[k] ?? 0;
    if (!v || !isWeapon[v - 1]) continue;
    total++;
    const x = k % f.w, y = (k - x) / f.w;
    const body = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < f.w && yy < f.h && (f.px[yy * f.w + xx] ?? 0) > 0;
    if (body(x - 1, y) && body(x + 1, y) && body(x, y - 1) && body(x, y + 1)) buried++;
  }
  const ratio = total ? buried / total : 0;
  return { id: 'form.weapon-separation', pass: ratio <= maxRatio, value: Math.round(ratio * 100) / 100, threshold: maxRatio, ...(ratio > maxRatio ? { note: `검 픽셀 ${Math.round(ratio * 100)}%가 몸에 묻힘` } : {}) };
}

/** view.top-visibility(정보) — 머리 윗면 행 수: 맨 위에서 폭이 머리 최대 폭(위 25%)의 70%에 이를 때까지 줄 수. 3/4 시점 문구 효과 측정용 */
export function topVisibilityCheck(r: ImportResult): ImportCheck {
  const vals = r.frames.map(({ frame: f }) => {
    const top = topRow(f);
    if (top < 0) return 0;
    const width = (y: number) => { let a = -1, b = -1; for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x]) { if (a < 0) a = x; b = x; } return a < 0 ? 0 : b - a + 1; };
    let bottom = f.h - 1;
    while (bottom > top && !f.px.subarray(bottom * f.w, (bottom + 1) * f.w).some(Boolean)) bottom--;
    const span = Math.max(1, Math.floor((bottom - top + 1) / 4));
    let head = 0;
    for (let y = top; y < top + span; y++) head = Math.max(head, width(y));
    let n = 0;
    while (top + n < top + span && width(top + n) < head * 0.7) n++;
    return n;
  });
  const v = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  return { id: 'view.top-visibility', pass: true, value: v, threshold: 0, note: '정보(경고 아님): 머리 윗면 행 수 평균' };
}
