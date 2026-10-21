/**
 * 도형 래스터 결과. 마스크 왼쪽 위 픽셀이 앵커 기준 (ox, oy)에 놓인다.
 * 채움 도형의 앵커는 바운딩 박스 중심: 홀수 크기면 픽셀 (0,0)의 중심, 짝수 크기면 픽셀 (-1,-1)과 (0,0) 사이 모서리.
 */
export interface ShapeMask {
  w: number;
  h: number;
  ox: number;
  oy: number;
  mask: Uint8Array;
  /** (nx, ny, nz) × 127, 픽셀당 3칸 */
  normals?: Int8Array;
}

const EPS = 1e-9;

/** 90° 배수는 정확한 값을 써서 회전 전후 픽셀 수가 같게 한다. 화면 y가 아래로 가므로 양수 각도 = 시계 방향 */
export function rotCS(deg: number): [number, number] {
  const q = deg / 90;
  if (Number.isInteger(q)) {
    const k = ((q % 4) + 4) % 4;
    return ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[k] as [number, number];
  }
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/** 반폭 extent를 덮는 가장 작은 정수 폭. 중심이 격자에서 어긋나지 않게 parityFrom과 홀짝을 맞춘다 */
export function boxSize(extent: number, parityFrom: number): number {
  let n = Math.max(1, Math.ceil(2 * extent - EPS));
  if ((n - parityFrom) % 2 !== 0) n++;
  return n;
}

export function writeNormal(out: Int8Array, i: number, nx: number, ny: number, nz: number): void {
  const len = Math.hypot(nx, ny, nz) || 1;
  out[i * 3] = Math.round((nx / len) * 127);
  out[i * 3 + 1] = Math.round((ny / len) * 127);
  out[i * 3 + 2] = Math.round((nz / len) * 127);
}

export interface BoxGrid {
  W: number;
  H: number;
  c: number;
  s: number;
}

/**
 * 회전된 박스 안 모든 픽셀 중심을 도형 로컬 좌표 (lu, lv)로 돌려 inside에 묻는다.
 * inside는 법선(로컬 좌표, 정규화 전)을 돌려주거나, 바깥이면 null.
 */
export function rasterizeLocal(
  grid: BoxGrid,
  inside: (lu: number, lv: number) => readonly [number, number, number] | null,
): ShapeMask {
  const { W, H, c, s } = grid;
  const mask = new Uint8Array(W * H);
  const normals = new Int8Array(W * H * 3);
  for (let j = 0; j < H; j++) {
    const v = j + 0.5 - H / 2;
    for (let i = 0; i < W; i++) {
      const u = i + 0.5 - W / 2;
      const n = inside(u * c + v * s, -u * s + v * c);
      if (!n) continue;
      const k = j * W + i;
      mask[k] = 1;
      writeNormal(normals, k, n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]);
    }
  }
  return { w: W, h: H, ox: -Math.floor(W / 2), oy: -Math.floor(H / 2), mask, normals };
}

export const INSIDE_EPS = EPS;
