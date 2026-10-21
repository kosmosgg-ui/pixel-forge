import { createZone, type ZoneBuffer } from '@pixel-forge/core';

export const AUTO = 255;

/** 렌더 중간 버퍼: 코어 ZoneBuffer + 법선, 뒤쪽 층 여부, 고정 shade, 광원 세기 */
export interface FrameZone extends ZoneBuffer {
  /** (nx, ny, nz) × 127 */
  normal: Int8Array;
  /** depthLayer = back이면 1 */
  back: Uint8Array;
  /** mask legend로 정해진 shade, AUTO = 자동 */
  fixed: Uint8Array;
  /** max(0, n·L), 외곽선 판정용 */
  lit: Float32Array;
}

export function createFrameZone(w: number, h: number): FrameZone {
  const n = w * h;
  return { ...createZone(w, h), normal: new Int8Array(n * 3), back: new Uint8Array(n), fixed: new Uint8Array(n).fill(AUTO), lit: new Float32Array(n) };
}
