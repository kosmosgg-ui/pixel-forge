import { ForgeError, type IndexedRaster } from '@pixel-forge/core';
import type { RenderContext } from './render-frame.js';

export interface SizeFit {
  requested: string;
  used: string;
  /** fits = 요청 등급에 들어감, bounds = 넘쳐서 올림, locked = sizeClassLock이라 넘쳐도 그대로, too-large = 어느 등급에도 안 들어감 */
  reason: 'fits' | 'bounds' | 'locked' | 'too-large';
}

export interface FitFrame {
  raster: IndexedRaster;
  /** 캔버스 밖으로 잘린 파츠 픽셀 수 */
  clipped: number;
}

/** bounds.canvas 기준(가장자리 1px 불투명) + 잘린 파츠 픽셀 — 잘림까지 넘침으로 봐 bounds.canvas보다 약간 보수적 */
export function overflows(frames: readonly FitFrame[]): boolean {
  return frames.some(({ raster: r, clipped }) => {
    if (clipped > 0) return true;
    for (let x = 0; x < r.w; x++) if (r.px[x] || r.px[(r.h - 1) * r.w + x]) return true;
    for (let y = 0; y < r.h; y++) if (r.px[y * r.w] || r.px[y * r.w + r.w - 1]) return true;
    return false;
  });
}

/**
 * 크기 등급 맞춤: Spec sizeClass로 전 프레임을 렌더해 보고 넘치면, 바이블 sizeClasses 중 요청보다 작지 않은 등급을
 * 면적 순으로 다시 렌더해 처음 들어가는 등급을 쓴다. 판정을 최종 픽셀로 해 정리 단계에서 지워지는 1px 때문에 과하게 올리지 않는다
 * (기하 범위만 보면 그렇게 된다). 리그는 로드 때 요청 등급으로 정한 것을 그대로 쓴다. 들어가는 등급이 없으면 요청 등급 결과를 그대로 돌려준다.
 */
export function renderFitted<T>(ctx: RenderContext, render: (c: RenderContext) => T, framesOf: (t: T) => readonly FitFrame[]): { result: T; fit: SizeFit } {
  const requested = ctx.spec.sizeClass;
  const req = ctx.bible.sizeClasses[requested];
  if (!req) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${requested}`);
  const first = render(ctx);
  if (!overflows(framesOf(first))) return { result: first, fit: { requested, used: requested, reason: 'fits' } };
  if (ctx.spec.sizeClassLock) return { result: first, fit: { requested, used: requested, reason: 'locked' } };
  const bigger = Object.entries(ctx.bible.sizeClasses)
    .filter(([, s]) => s[0] >= req[0] && s[1] >= req[1] && s[0] * s[1] > req[0] * req[1])
    .sort(([an, a], [bn, b]) => a[0] * a[1] - b[0] * b[1] || an.localeCompare(bn));
  for (const [name] of bigger) {
    const t = render({ ...ctx, spec: { ...ctx.spec, sizeClass: name } });
    if (!overflows(framesOf(t))) return { result: t, fit: { requested, used: name, reason: 'bounds' } };
  }
  // 바닥선 아래로 내려가는 포즈 등 등급으로 풀 수 없는 넘침 — bounds.canvas가 실패로 알린다
  return { result: first, fit: { requested, used: requested, reason: 'too-large' } };
}
