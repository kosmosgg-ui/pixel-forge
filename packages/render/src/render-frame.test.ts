import { describe, expect, it } from 'vitest';
import { equals, flipX, ForgeError } from '@pixel-forge/core';
import { assertFrame } from './assert.js';
import { renderFrame } from './render-frame.js';
import { bible, circle, ctx, rig, spec } from './test-fixture.js';

const opaque = (r: { px: Uint8Array }) => r.px.reduce((a, v) => a + (v ? 1 : 0), 0);

describe('renderFrame', () => {
  it('원 하나: 캔버스 크기, 바닥 여백, 팔레트 안 인덱스', () => {
    const { raster } = renderFrame(ctx(spec([circle()])));
    expect([raster.w, raster.h]).toEqual([24, 24]);
    const rows = Array.from({ length: 24 }, (_, y) => raster.px.subarray(y * 24, y * 24 + 24).some((v) => v > 0));
    expect(rows[23]).toBe(false);
    expect(rows[22]).toBe(true);
  });

  it('광원 x를 반대로 하면 밝은 면이 좌우 반전된다', () => {
    // 짝수 폭이어야 24px 캔버스 가운데에 정확히 놓인다
    const s = spec([circle('root', 8)]);
    const a = renderFrame(ctx(s, bible({ outline: { mode: 'none', globalColor: '#101018' } }))).raster;
    const b = renderFrame(ctx(s, bible({ outline: { mode: 'none', globalColor: '#101018' }, light: { dir: [0.6, -0.7, 0.4], ambient: 0.15 } }))).raster;
    expect(equals(flipX(a), b)).toBe(true);
    expect(equals(a, b)).toBe(false);
  });

  it('외곽선 none은 실루엣만, dark는 전역 외곽선색 1px 테두리', () => {
    const s = spec([circle()]);
    const none = renderFrame(ctx(s, bible({ outline: { mode: 'none', globalColor: '#101018' } })));
    const c = ctx(s, bible({ outline: { mode: 'dark', globalColor: '#101018' } }));
    const dark = renderFrame(c);
    const ring = Array.from(dark.raster.px).filter((v, i) => v && !none.raster.px[i]);
    expect(ring.length).toBeGreaterThan(0);
    expect(new Set(ring)).toEqual(new Set([c.palette.outlineIndex]));
  });

  it('selout: 광원 쪽은 ramp[0], 어두운 쪽은 재질 외곽선 톤', () => {
    const c = ctx(spec([circle()]));
    const none = renderFrame(ctx(spec([circle()]), bible({ outline: { mode: 'none', globalColor: '#101018' } })));
    const { raster } = renderFrame(c);
    const ramp = c.palette.ramps.m;
    const ring = new Set(Array.from(raster.px).filter((v, i) => v && !none.raster.px[i]));
    expect(ring).toEqual(new Set([ramp?.indices[0], ramp?.outline]));
  });

  it('depthLayer=back 파츠는 같은 도형보다 어둡다(인덱스가 램프 아래쪽)', () => {
    const front = renderFrame(ctx(spec([circle('root')]), bible({ outline: { mode: 'none', globalColor: '#101018' } }))).raster;
    const back = renderFrame(ctx(spec([circle('back')]), bible({ outline: { mode: 'none', globalColor: '#101018' } }))).raster;
    const sum = (r: typeof front) => r.px.reduce((a, v) => a + v, 0);
    expect(opaque(back)).toBe(opaque(front));
    expect(sum(back)).toBeLessThan(sum(front));
  });

  it('렌더러는 뼈 이름에 의존하지 않는다', () => {
    const a = renderFrame(ctx(spec([circle('root'), { ...circle('back', 5), z: 0 }]))).raster;
    const b = renderFrame(ctx(spec([circle('pelvis'), { ...circle('rear', 5), z: 0 }], { rig: 'r' }), bible(), rig(['pelvis', 'rear']))).raster;
    expect(equals(a, b)).toBe(true);
  });

  it('kind가 character가 아니면 spec.kind-not-implemented', () => {
    expect(() => renderFrame(ctx(spec([circle()], { kind: 'item' })))).toThrow(/kind/);
    try { renderFrame(ctx(spec([circle()], { kind: 'tile' }))); } catch (e) { expect((e as ForgeError).code).toBe('spec.kind-not-implemented'); }
  });

  it('검증 훅: 팔레트 밖 인덱스는 ForgeError', () => {
    const c = ctx(spec([circle()]));
    const { raster } = renderFrame(c);
    raster.px[0] = 250;
    expect(() => assertFrame(raster, c.palette.palette)).toThrow(ForgeError);
  });

  it('결정론: 2회 렌더 결과 동일', () => {
    const c = ctx(spec([circle(), { bone: 'root', shape: { type: 'capsule', len: 9, w: 4, angleDeg: 30 }, material: 'm' }]));
    expect(equals(renderFrame(c).raster, renderFrame(c).raster)).toBe(true);
  });
});
