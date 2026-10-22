import type { RgbaImage } from './types.js';

/** 모서리 4점이 모두 불투명할 때 그 최빈색(동률은 왼쪽 위부터) — 배경이 투명한 입력이면 null */
export function cornerBackground(img: RgbaImage): [number, number, number] | null {
  const { w, h, rgba } = img;
  const pts = [0, w - 1, (h - 1) * w, h * w - 1];
  if (pts.some((k) => (rgba[k * 4 + 3] ?? 0) < 255)) return null;
  const cols = pts.map((k) => [rgba[k * 4] ?? 0, rgba[k * 4 + 1] ?? 0, rgba[k * 4 + 2] ?? 0] as [number, number, number]);
  let best = cols[0] ?? [255, 255, 255], bestN = 0;
  for (const c of cols) {
    const n = cols.filter((d) => near(c, d, 8)).length;
    if (n > bestN) { best = c; bestN = n; }
  }
  return best;
}

const near = (a: readonly number[], b: readonly number[], tol: number) => Math.max(Math.abs((a[0] ?? 0) - (b[0] ?? 0)), Math.abs((a[1] ?? 0) - (b[1] ?? 0)), Math.abs((a[2] ?? 0) - (b[2] ?? 0))) <= tol;

/**
 * 허용오차: 이미지 둘레 픽셀의 배경색 거리 90번째 값 + 10(최소 minTol, 최대 60). GPT 단색 배경은 위치마다 조금씩 다르다
 * (U3 마젠타 시트: G 5~37) — 고정 24로는 배경 일부가 남아 스프라이트가 하나로 붙는다.
 */
function borderTolerance(img: RgbaImage, bg: readonly number[], minTol: number): number {
  const { w, h, rgba } = img, d: number[] = [];
  const at = (k: number) => Math.max(Math.abs((rgba[k * 4] ?? 0) - (bg[0] ?? 0)), Math.abs((rgba[k * 4 + 1] ?? 0) - (bg[1] ?? 0)), Math.abs((rgba[k * 4 + 2] ?? 0) - (bg[2] ?? 0)));
  for (let x = 0; x < w; x++) d.push(at(x), at((h - 1) * w + x));
  for (let y = 0; y < h; y++) d.push(at(y * w), at(y * w + w - 1));
  d.sort((a, b) => a - b);
  return Math.min(60, Math.max(minTol, (d[Math.floor(d.length * 0.9)] ?? 0) + 10));
}

/**
 * 불투명 단색 배경 제거: 배경색과 허용오차 안이면서 **이미지 가장자리와 이어진** 픽셀만 투명.
 * 캐릭터 안쪽의 흰 천·은색 갑옷은 외곽선에 둘러싸여 가장자리와 이어지지 않으므로 남는다. 반환 = 지운 픽셀 수.
 */
export function removeBackgroundInPlace(img: RgbaImage, minTol = 24): number {
  const bg = cornerBackground(img);
  if (!bg) return 0;
  const { w, h, rgba } = img;
  const tol = borderTolerance(img, bg, minTol);
  const seen = new Uint8Array(w * h), stack: number[] = [];
  const push = (k: number) => {
    if (seen[k]) return;
    seen[k] = 1;
    if (near([rgba[k * 4] ?? 0, rgba[k * 4 + 1] ?? 0, rgba[k * 4 + 2] ?? 0], bg, tol)) stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  let n = 0;
  while (stack.length) {
    const k = stack.pop() ?? 0, x = k % w, y = (k - x) / w;
    rgba[k * 4 + 3] = 0;
    n++;
    if (x > 0) push(k - 1);
    if (x < w - 1) push(k + 1);
    if (y > 0) push(k - w);
    if (y < h - 1) push(k + w);
  }
  return n;
}

/** 알파 이진화: alpha ≥ threshold → 255, 아니면 0(색도 0으로 — 투명 칸의 남은 색이 축소·팔레트에 섞이지 않게) */
export function binarizeAlphaInPlace(img: RgbaImage, threshold: number): void {
  const { rgba } = img;
  for (let k = 0; k < rgba.length; k += 4) {
    if ((rgba[k + 3] ?? 0) >= threshold) rgba[k + 3] = 255;
    else { rgba[k] = 0; rgba[k + 1] = 0; rgba[k + 2] = 0; rgba[k + 3] = 0; }
  }
}

/**
 * 키 배경 번짐 빼기(despill, G2 U3): 투명에서 band px 안의 불투명 픽셀 중 배경 우세 채널이 나머지보다 40 넘게 높으면
 * 우세 채널을 나머지 채널 기준(+16)까지 끌어내린다. 마젠타 배경 = R·B를 G 기준으로, 초록 배경 = G를 R·B 기준으로.
 * 축소 뒤(게임 크기) RGBA에 쓴다 — 바뀐 픽셀 수를 돌려준다.
 */
export function despillEdgesInPlace(img: RgbaImage, key: readonly [number, number, number], band = 2): number {
  const { w, h, rgba } = img;
  const dom = [0, 1, 2].map((c) => (key[c] ?? 0) > 160);
  if (dom.every(Boolean) || !dom.some(Boolean)) return 0;
  const clear = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || (rgba[(y * w + x) * 4 + 3] ?? 0) === 0;
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4;
    if (!rgba[k + 3]) continue;
    let near = false;
    for (let dy = -band; dy <= band && !near; dy++) for (let dx = -band; dx <= band && !near; dx++) near = clear(x + dx, y + dy);
    if (!near) continue;
    const c = [rgba[k] ?? 0, rgba[k + 1] ?? 0, rgba[k + 2] ?? 0];
    const rest = Math.max(...c.filter((_, i) => !dom[i]));
    if (!c.every((v, i) => !dom[i] || v - rest > 40)) continue;
    for (let i = 0; i < 3; i++) if (dom[i]) rgba[k + i] = Math.min(c[i] ?? 0, rest + 16);
    n++;
  }
  return n;
}
