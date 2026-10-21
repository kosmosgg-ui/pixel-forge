import { createFrameZone, type FrameZone } from './frame-zone.js';
import type { PlacedPart } from './place.js';
import type { PartRaster } from './rasterize-part.js';

/** 파츠 하나만 담은 zone(파츠 래스터 크기). 셰이딩·작은 섬 정리를 파츠 단위로 하기 위한 작업 버퍼 */
export function partZone(p: PlacedPart, r: PartRaster): FrameZone {
  const z = createFrameZone(r.w, r.h);
  writePartInPlace(z, p, { ...r, x0: 0, y0: 0 }, 0, 0);
  return z;
}

/**
 * 파츠를 depth 비교로 zone에 기록한다(앞 파츠가 이긴다). 캔버스 밖으로 나간 픽셀 수를 돌려준다.
 * shaded(partZone에서 셰이딩을 끝낸 버퍼)를 주면 shade·lit도 옮긴다.
 */
export function writePartInPlace(z: FrameZone, p: PlacedPart, r: PartRaster, tx: number, ty: number, shaded?: FrameZone): number {
  let clipped = 0;
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
    const s = j * r.w + i;
    if (!r.mask[s]) continue;
    const X = r.x0 + i + tx, Y = r.y0 + j + ty;
    if (X < 0 || Y < 0 || X >= z.w || Y >= z.h) { clipped++; continue; }
    const k = Y * z.w + X;
    if (p.depth < (z.depth[k] ?? 0)) continue;
    z.material[k] = r.material[s] ?? 0;
    z.depth[k] = p.depth;
    z.part[k] = p.index + 1;
    z.back[k] = p.layer === 'back' ? 1 : 0;
    z.fixed[k] = r.fixed[s] ?? 0;
    z.special[k] = r.special?.[s] ?? 0;
    // 법선이 없는 도형(선·mask)은 화면을 정면으로 본다
    z.normal[k * 3] = r.normals?.[s * 3] ?? 0;
    z.normal[k * 3 + 1] = r.normals?.[s * 3 + 1] ?? 0;
    z.normal[k * 3 + 2] = r.normals ? r.normals[s * 3 + 2] ?? 0 : 127;
    if (shaded) { z.shade[k] = shaded.shade[s] ?? 0; z.lit[k] = shaded.lit[s] ?? 0; }
  }
  return clipped;
}

/** 모든 파츠를 담는 월드 경계 [minX, minY, maxX, maxY] */
export function partsBounds(rs: readonly PartRaster[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of rs) for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
    if (!r.mask[j * r.w + i]) continue;
    a = Math.min(a, r.x0 + i); b = Math.min(b, r.y0 + j); c = Math.max(c, r.x0 + i); d = Math.max(d, r.y0 + j);
  }
  return [a, b, c, d];
}
