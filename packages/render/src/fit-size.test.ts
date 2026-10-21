import { describe, expect, it } from 'vitest';
import { overflows, renderFitted } from './fit-size.js';
import { renderFrame } from './render-frame.js';
import { bible, circle, ctx, spec } from './test-fixture.js';

const classes = bible({ sizeClasses: { s: [24, 24], wide: [40, 24], m: [32, 32], l: [64, 64] }, colorBudget: { s: 15, wide: 15, m: 15, l: 20 } });
const one = (c: Parameters<typeof renderFrame>[0]) => renderFrame(c);
const frames = (r: ReturnType<typeof renderFrame>) => [{ raster: r.raster, clipped: r.clipped }];

describe('renderFitted (크기 등급 맞춤)', () => {
  it('요청 등급에 들어가면 그대로(fits)', () => {
    expect(renderFitted(ctx(spec([circle('root', 9)]), classes), one, frames).fit).toEqual({ requested: 's', used: 's', reason: 'fits' });
  });

  it('넘치면 요청보다 작지 않고 들어가는 가장 작은 등급으로 다시 렌더(bounds), 결과는 가장자리 비어 있음', () => {
    // 지름 26 원: 24는 넘치고, 40×24는 높이가 모자라고, 32에 들어감
    const { result, fit } = renderFitted(ctx(spec([circle('root', 26)]), classes), one, frames);
    expect(fit).toEqual({ requested: 's', used: 'm', reason: 'bounds' });
    expect([result.raster.w, result.raster.h]).toEqual([32, 32]);
    expect(overflows(frames(result))).toBe(false);
  });

  it('sizeClassLock이면 올리지 않음(locked), 어느 등급에도 안 들어가면 too-large(요청 등급 결과)', () => {
    expect(renderFitted(ctx(spec([circle('root', 26)], { sizeClassLock: true }), classes), one, frames).fit).toMatchObject({ used: 's', reason: 'locked' });
    const big = renderFitted(ctx(spec([circle('root', 70)]), classes), one, frames);
    expect(big.fit).toMatchObject({ used: 's', reason: 'too-large' });
    expect(big.result.raster.w).toBe(24);
  });
});
