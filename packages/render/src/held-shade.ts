import type { FrameZone } from './frame-zone.js';
import type { PartRaster } from './rasterize-part.js';

/**
 * rule: form.held-thin-shade — 두께 maxThickness 이하인 held 파츠는 몸체를 램프의 가장 밝은 brightSteps단계로만 칠하고
 * (빛 받는 쪽이 맨 위 단계), 부착점(손)에 가장 가까운 1px(손잡이)과 가장 먼 1px(날끝)만 0단계로 둔다.
 * 얇은 날의 어두운 줄이 게임 배경에 묻혀 무기가 1px로 보이는 것을 막는다.
 * local은 partZone(파츠 래스터 좌표), joint는 부착 뼈 관절의 월드 좌표.
 */
export function heldThinShadeInPlace(local: FrameZone, r: PartRaster, joint: readonly [number, number], steps: number, brightSteps: number): void {
  const top = steps - 1, low = Math.max(0, steps - brightSteps);
  let near = -1, far = -1, dNear = Infinity, dFar = -Infinity;
  for (let k = 0; k < local.material.length; k++) {
    if (!local.material[k]) continue;
    const s = local.shade[k] ?? 0;
    // 원래 단계를 [low, top]으로 눌러 담는다(맨 위 단계만 top)
    local.shade[k] = top > 0 ? low + Math.floor((Math.min(s, top) * (top - low)) / top) : 0;
    const x = r.x0 + (k % r.w), y = r.y0 + Math.floor(k / r.w);
    const d = (x - joint[0]) ** 2 + (y - joint[1]) ** 2;
    // 동률이면 앞 순번(위·왼쪽) — 결정론
    if (d < dNear) { dNear = d; near = k; }
    if (d > dFar) { dFar = d; far = k; }
  }
  if (near >= 0) local.shade[near] = 0;
  if (far >= 0) local.shade[far] = 0;
}
