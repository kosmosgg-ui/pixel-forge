import { check, type Check, type HeldInfo, type QaContext, type QaFrame } from '../types.js';

/**
 * form.held-visible (필수): 손에 든 무기·소품이 모든 프레임에서 보이고 손에 붙어 있어야 한다.
 * - 보이는 픽셀 = 그 파츠 픽셀 중 외곽선 톤·전역 외곽선색이 아닌 것(선 색으로만 칠해지면 배경에 묻힌다)
 * - 보이는 픽셀 수 ≥ rest 파츠 픽셀 수 × heldVisibleMin
 * - 손 파츠(부착 뼈의 부모 뼈 파츠)에서 같은 뼈 파츠(날밑·손잡이)를 거쳐 8-연결로 이 파츠에 닿음
 * 값은 가장 낮은 (보이는 픽셀 ÷ rest 픽셀) 비율.
 */
export function formHeldVisible(frames: readonly QaFrame[], ctx: QaContext): Check {
  const min = ctx.rules.heldVisibleMin;
  if (!ctx.held?.length) return check('form.held-visible', true, true, null, min, { note: 'held 파츠 없음' });
  let worst = Infinity, failFrame = -1;
  let failNote = '';
  const where: [number, number][] = [];
  frames.forEach((f, fi) => {
    const { raster: r, part } = f;
    if (!part) return;
    for (const h of ctx.held ?? []) {
      const reach = reachFromHand(part, r.w, r.h, h);
      let visible = 0, attached = false;
      for (let k = 0; k < part.length; k++) {
        if (part[k] !== h.part) continue;
        if (!ctx.lineIndices?.has(r.px[k] ?? 0)) visible++;
        if (reach[k]) attached = true;
      }
      const ratio = h.restCount ? visible / h.restCount : 0;
      const bad = ratio < min || !attached;
      if (bad && failFrame < 0) {
        failFrame = fi;
        failNote = `${f.name} ${h.name}: ${!attached ? '손에서 떨어짐' : `보이는 픽셀 ${visible}/${h.restCount}`}`;
        for (let k = 0; k < part.length && where.length < 16; k++) if (part[k] === h.part) where.push([k % r.w, Math.floor(k / r.w)]);
      }
      worst = Math.min(worst, attached ? ratio : 0);
    }
  });
  const value = Math.round((worst === Infinity ? 1 : worst) * 1000) / 1000;
  return check('form.held-visible', true, failFrame < 0, value, min, failFrame >= 0 ? { where, frame: failFrame, note: failNote } : {});
}

/** 손 픽셀에서 시작해 손·같은 뼈 파츠 픽셀을 8-연결로 따라간 도달 표시 */
function reachFromHand(part: Uint16Array, w: number, h: number, info: HeldInfo): Uint8Array {
  const ok = new Set([...info.hand, ...(info.group ?? []), info.part]);
  const hand = new Set(info.hand);
  const seen = new Uint8Array(part.length);
  const stack: number[] = [];
  for (let k = 0; k < part.length; k++) if (hand.has(part[k] ?? 0)) { seen[k] = 1; stack.push(k); }
  while (stack.length) {
    const k = stack.pop() ?? 0;
    const x = k % w, y = (k - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if (X < 0 || Y < 0 || X >= w || Y >= h || seen[j] || !ok.has(part[j] ?? 0)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}
