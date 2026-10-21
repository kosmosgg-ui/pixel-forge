/** 렌더 중간 단계 버퍼 (§3) */
export interface ZoneBuffer {
  w: number;
  h: number;
  /** 재질 id, 0 = 비어 있음 */
  material: Uint8Array;
  /** 램프 단계 */
  shade: Uint8Array;
  depth: Uint8Array;
  part: Uint16Array;
}

export function createZone(w: number, h: number): ZoneBuffer {
  const n = w * h;
  return { w, h, material: new Uint8Array(n), shade: new Uint8Array(n), depth: new Uint8Array(n), part: new Uint16Array(n) };
}
