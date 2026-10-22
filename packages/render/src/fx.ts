import { pixelPerfectPath, type IndexedRaster } from '@pixel-forge/core';
import type { BoneWorld } from '@pixel-forge/rig';
import type { FxDef } from '@pixel-forge/spec';

/**
 * fx 레이어(§8.2): 바이블 fxColors만 쓰고 실루엣 위에 합성한다. 그린 위치는 protect로 정리 단계에서 지킨다.
 * flash = 불투명 픽셀 전부 fx 색, arc = 뼈 관절을 중심으로 한 1px 호(L자 모서리 제거), line = 관절에서 뻗는 직선(화살 궤적).
 */
export function applyFxInPlace(
  r: IndexedRaster, fx: FxDef, bones: Readonly<Record<string, BoneWorld>>, origin: readonly [number, number],
  fxIndices: readonly number[], protect: Uint8Array,
): void {
  const color = fxIndices[fx.color];
  if (color === undefined) return;
  if (fx.type === 'flash') {
    for (let k = 0; k < r.px.length; k++) if (r.px[k]) { r.px[k] = color; protect[k] = 1; }
    return;
  }
  const b = bones[fx.bone];
  if (!b) return;
  const cx = b.x + origin[0], cy = b.y + origin[1];
  if (fx.type === 'line') {
    const rad = (fx.dirDeg * Math.PI) / 180;
    for (let t = fx.from; t <= fx.from + fx.length; t++) {
      const x = Math.round(cx + t * Math.cos(rad)), y = Math.round(cy + t * Math.sin(rad));
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
      r.px[y * r.w + x] = color;
      protect[y * r.w + x] = 1;
    }
    return;
  }
  const pts: [number, number][] = [];
  const from = Math.min(fx.fromDeg, fx.toDeg), to = Math.max(fx.fromDeg, fx.toDeg);
  // 반지름에 맞춘 각도 간격: 이웃 표본이 1px 안쪽에 오도록
  const step = (0.5 / fx.radius) * (180 / Math.PI);
  for (let a = from; a <= to + 1e-9; a += step) {
    const rad = (a * Math.PI) / 180;
    const p: [number, number] = [Math.round(cx + fx.radius * Math.cos(rad)), Math.round(cy + fx.radius * Math.sin(rad))];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  for (const [x, y] of pixelPerfectPath(pts)) {
    if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
    r.px[y * r.w + x] = color;
    protect[y * r.w + x] = 1;
  }
}

/** 리그 축척(proportions.height ÷ baseHeight)에 맞춘 fx — 작은 몬스터에 사람 크기 베기 호가 그려지지 않게 */
export function scaleFx(fx: FxDef, scale: number): FxDef {
  if (fx.type === 'arc') return { ...fx, radius: Math.max(1, Math.round(fx.radius * scale)) };
  return fx.type === 'line' ? { ...fx, length: Math.max(1, Math.round(fx.length * scale)) } : fx;
}
