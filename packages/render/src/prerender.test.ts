import { describe, expect, it } from 'vitest';
import { prerenderEyeCount, renderPrerender, type PassFrame, type PrerenderPasses } from './prerender.js';
import { bible, ctx, spec } from './test-fixture.js';

const S = 2, W = 24 * S;
const c = ctx(spec([], { mode: 'prerender', model: 'data/models/x/x.glb', actions: { idle: 'Idle' }, height: 16 }),
  bible({ materials: { m: { base: '#a83c3c', steps: 4, kind: 'cloth' }, n: { base: '#3c5aa8', steps: 4, kind: 'cloth' } } }));

/** 2배 패스 1장: (x0..x1, y0..y1) 사각형을 재질 mat·알베도 rgb·법선(보는 쪽)으로 */
function frame(rects: { x: [number, number]; y: [number, number]; mat: number; rgb?: [number, number, number] }[]): PassFrame {
  const n = W * W, f: PassFrame = { anim: 'idle', dir: 's', index: 0, ms: 100, mat: new Uint8Array(n), obj: new Uint8Array(n), normal: new Int8Array(n * 3), albedo: new Uint8Array(n * 3), transforms: [1] };
  for (const r of rects) for (let y = r.y[0]; y <= r.y[1]; y++) for (let x = r.x[0]; x <= r.x[1]; x++) {
    const k = y * W + x;
    f.mat[k] = r.mat; f.obj[k] = 1; f.normal[k * 3 + 2] = 127;
    (r.rgb ?? [200, 50, 50]).forEach((v, i) => { f.albedo[k * 3 + i] = v; });
  }
  return f;
}
const passes = (fs: PassFrame[], materials = ['Body', 'Eye']): PrerenderPasses => ({ supersample: S, materials, frames: fs });

describe('prerender', () => {
  it('재질 매핑 → 바이블 램프만, 2×2 다수결로 1배, 외곽선이 붙는다', () => {
    const r = renderPrerender(c, passes([frame([{ x: [10, 37], y: [8, 41], mat: 1 }])]), { materialMap: { Body: 'm', Eye: '@eye' }, toon: [-0.1, 0.45] });
    const used = new Set(r.rest.raster.px);
    const ramps = c.palette.ramps;
    const allowed = new Set([0, c.palette.outlineIndex, ...Object.values(ramps).flatMap((x) => [...x.indices, x.outline])]);
    expect([...used].every((v) => allowed.has(v))).toBe(true);
    // 2배 28×34 칸 → 1배 14×17, 둘레 외곽선 1px
    expect([...r.rest.raster.px].filter(Boolean).length).toBe(14 * 17 + 2 * (14 + 17));
    expect(r.frames[0]).toMatchObject({ anim: 'idle', dir: 's', index: 0 });
  });

  it('팔레트형 텍스처: 알베도에 가장 가까운 견본의 재질로, 눈 칸 1개라도 2×2 블록을 이긴다', () => {
    const f = frame([{ x: [10, 23], y: [8, 41], mat: 1, rgb: [190, 60, 60] }, { x: [24, 37], y: [8, 41], mat: 1, rgb: [60, 90, 170] }, { x: [16, 16], y: [12, 12], mat: 2 }]);
    const o = { materialMap: { Body: '@palette', Eye: '@eye' }, palette: { Body: [{ hex: '#c03030', to: 'm' }, { hex: '#3050b0', to: 'n' }] }, toon: [-0.1, 0.45] as const };
    const r = renderPrerender(c, passes([f]), o);
    const mats = new Set([...r.rest.meta.layers.material].filter(Boolean));
    expect(mats.size).toBe(2);
    expect(r.rest.meta.eyes).toHaveLength(1);
    expect(r.rest.raster.px[r.rest.meta.eyes[0] ?? 0]).toBe(c.palette.outlineIndex);
    expect(prerenderEyeCount(c, passes([f]), f, o)).toBe(1);
  });

  it('매핑 없는 모델 재질이 화면에 있으면 spec.refs', () => {
    expect(() => renderPrerender(c, passes([frame([{ x: [10, 20], y: [10, 20], mat: 1 }])]), { materialMap: {}, toon: [-0.1, 0.45] })).toThrow(expect.objectContaining({ code: 'spec.refs' }));
  });
});
