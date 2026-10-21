import { check, type Check, type QaContext, type QaFrame } from '../types.js';

/** baseline.stable: rootFixed 프레임들의 발 최하단(가장 아래 불투명 줄) y가 모두 같다. 대상 2장 미만이면 통과 */
export function baselineStable(frames: readonly QaFrame[]): Check {
  const ys = frames.filter((f) => f.rootFixed !== false).map(({ raster: r }) => {
    for (let y = r.h - 1; y >= 0; y--) for (let x = 0; x < r.w; x++) if (r.px[y * r.w + x]) return y;
    return -1;
  });
  if (ys.length < 2) return check('baseline.stable', true, true, 0, 0, { note: '대상 프레임 1장' });
  const spread = Math.max(...ys) - Math.min(...ys);
  return check('baseline.stable', true, spread === 0, spread, 0);
}

/** anim.flicker: 앞 프레임과 변환이 같은 파츠(stillParts) 영역에서 색이 바뀐 픽셀 수 ≤ flickerMax */
export function animFlicker(frames: readonly QaFrame[], ctx: QaContext): Check {
  const max = ctx.rules.flickerMax;
  if (frames.length < 2) return check('anim.flicker', true, true, 0, max, { note: '프레임 1장' });
  let bad = 0;
  const where: [number, number][] = [];
  let frame: number | undefined;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (!a?.part || !b?.part || !b.stillParts) continue;
    for (let k = 0; k < b.part.length; k++) {
      const p = b.part[k] ?? 0;
      if (!p || a.part[k] !== p || !b.stillParts.has(p) || a.raster.px[k] === b.raster.px[k]) continue;
      bad++;
      frame ??= i;
      where.push([k % b.raster.w, Math.floor(k / b.raster.w)]);
    }
  }
  return check('anim.flicker', true, bad <= max, bad, max, bad ? { where, ...(frame !== undefined ? { frame } : {}) } : {});
}
