import { ForgeError, type IndexedRaster, type Palette } from '@pixel-forge/core';

/** 검증 훅(§6.9): 팔레트 밖 인덱스가 없어야 한다. 알파는 인덱스 래스터라 0(투명) 또는 불투명만 가능 */
export function assertFrame(r: IndexedRaster, palette: Palette): void {
  for (let i = 0; i < r.px.length; i++) {
    const v = r.px[i] ?? 0;
    if (v >= palette.colors.length) {
      throw new ForgeError('render.palette-conformance', `팔레트 밖 인덱스 ${v}`, { x: i % r.w, y: Math.floor(i / r.w) });
    }
  }
}
