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

  it('눈: 3/4 리그면 2개, 먼 쪽 눈은 머리 외곽에서 1px 띄우고, 정리 단계에서 지워지지 않는다', () => {
    const eyes = { bone: 'root', pos: [0, 0], size: 1, color: 'm:0' };
    const c = ctx(spec([circle('root', 9)], { eyes }), bible(), rig(['root', 'back'], { count: 2, spacing: 6 }));
    const { raster, meta } = renderFrame(c);
    expect(meta.eyes).toHaveLength(2);
    const [near, far] = meta.eyes as [number, number];
    for (const k of meta.eyes) expect(raster.px[k]).toBe(c.palette.ramps.m?.indices[0]);
    // 원 폭 9: 오른쪽 끝 열에 붙지 않도록 간격 6 → 3으로 당겨진다
    expect(far - near).toBe(3);
  });

  it('면적 < smallPartArea 파츠는 3단계(어둠·기본·하이라이트)만', () => {
    const c = ctx(spec([circle('root', 3)]), bible({ outline: { mode: 'none', globalColor: '#101018' } }));
    const { raster, meta } = renderFrame(c);
    expect(meta.smallParts).toEqual([0]);
    const ramp = c.palette.ramps.m!;
    const allowed = [ramp.indices[0], ramp.indices[1], ramp.indices[3]];
    for (const v of raster.px) if (v) expect(allowed).toContain(v);
  });

  it('form.outline-thin: 1px 선 무기 주변에 평행한 외곽선 픽셀 0개, 획은 외곽선 톤 + 하이라이트 1px', () => {
    const blade = { bone: 'root', shape: { type: 'line', from: [-5, 3], to: [5, -6] }, material: 'm', anchor: 'joint', orient: 'world' };
    const sel = ctx(spec([blade]));
    const withOutline = renderFrame(sel).raster;
    const none = renderFrame(ctx(spec([blade]), bible({ outline: { mode: 'none', globalColor: '#101018' } }))).raster;
    const ring = Array.from(withOutline.px).filter((v, i) => v && !none.px[i]);
    expect(ring).toHaveLength(0);
    const ramp = sel.palette.ramps.m!;
    const stroke = Array.from(withOutline.px).filter((v) => v);
    expect(stroke.filter((v) => v === ramp.indices[ramp.indices.length - 1])).toHaveLength(1);
    expect(stroke.filter((v) => v !== ramp.outline)).toHaveLength(1);
  });

  it('form.outline-thin: 두께 2px 이상 파츠는 기존대로 외곽선', () => {
    const bar = { bone: 'root', shape: { type: 'rect', w: 8, h: 2 }, material: 'm', orient: 'world' };
    const a = renderFrame(ctx(spec([bar]))).raster;
    const b = renderFrame(ctx(spec([bar]), bible({ outline: { mode: 'none', globalColor: '#101018' } }))).raster;
    expect(Array.from(a.px).filter((v, i) => v && !b.px[i]).length).toBeGreaterThan(0);
  });

  it('결정론: 2회 렌더 결과 동일', () => {
    const c = ctx(spec([circle(), { bone: 'root', shape: { type: 'capsule', len: 9, w: 4, angleDeg: 30 }, material: 'm' }]));
    expect(equals(renderFrame(c).raster, renderFrame(c).raster)).toBe(true);
  });
  it('rule: form.held-min-width — 손에 든 1px 획은 spec.held-too-thin, decorative·held 아님은 허용', () => {
    const stick = (over: Record<string, unknown>) => ({ bone: 'root', shape: { type: 'line', to: [0, -8] }, material: 'm', orient: 'world', name: 'stick', ...over });
    expect(() => renderFrame(ctx(spec([circle(), stick({ held: true })])))).toThrow(expect.objectContaining({ code: 'spec.held-too-thin' }));
    expect(() => renderFrame(ctx(spec([circle(), stick({ held: true, decorative: true })])))).not.toThrow();
    expect(() => renderFrame(ctx(spec([circle(), stick({})])))).not.toThrow();
    const thick = { bone: 'root', shape: { type: 'rect', w: 2, h: 8 }, material: 'm', orient: 'world', held: true };
    expect(() => renderFrame(ctx(spec([circle(), thick])))).not.toThrow();
  });
});
