/** §10 manifest — 엔진이 시트 JSON 없이도 애니·기준점·절차 애니 힌트를 읽게 */
export interface Manifest {
  id: string;
  bible: string;
  sizeClass: string;
  /** 프레임 크기 [w, h] */
  frameSize: [number, number];
  /** 발밑 기준점 [x, y]: x = 루트 관절, y = 가장 아래 불투명 픽셀 바로 아래 줄. 모든 프레임 공통 */
  pivot: [number, number];
  /** 'r' = 시트 프레임은 우향, 좌향은 엔진에서 좌우 반전. 'dirs' = 방향마다 렌더한 프레임(directions, 프리렌더) */
  facing: 'r' | 'dirs';
  directions?: string[];
  anims: Record<string, { frames: string[]; ms: number[]; loop: boolean }>;
  motion: unknown;
  /** 시트가 쓰는 색(#rrggbb, 팔레트 인덱스 순) */
  palette: string[];
  /** 시트 PNG 바이트 SHA-256 */
  hash: string;
}

export function buildManifest(m: Manifest): Manifest {
  // 키 순서를 고정해 같은 입력 → 같은 바이트
  return {
    id: m.id, bible: m.bible, sizeClass: m.sizeClass, frameSize: m.frameSize, pivot: m.pivot, facing: m.facing, ...(m.directions ? { directions: m.directions } : {}),
    anims: Object.fromEntries(Object.entries(m.anims).map(([k, a]) => [k, { frames: a.frames, ms: a.ms, loop: a.loop }])),
    motion: m.motion, palette: m.palette, hash: m.hash,
  };
}
