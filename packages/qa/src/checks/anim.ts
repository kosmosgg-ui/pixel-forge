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

/**
 * anim.flicker: 앞 프레임과 변환이 같은 파츠(stillParts) 영역에서 색이 바뀐 픽셀 수 ≤ flickerMax.
 * 외곽선·내부선·눈·fx 같은 mark 위치는 이웃 파츠가 움직이면 정당하게 바뀌므로 어느 쪽 프레임이든 표시돼 있으면 뺀다.
 */
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
      if (!p || a.part[k] !== p || !b.stillParts.has(p) || a.raster.px[k] === b.raster.px[k] || a.mark?.[k] || b.mark?.[k]) continue;
      bad++;
      frame ??= i;
      where.push([k % b.raster.w, Math.floor(k / b.raster.w)]);
    }
  }
  return check('anim.flicker', true, bad <= max, bad, max, bad ? { where, ...(frame !== undefined ? { frame } : {}) } : {});
}

const POSE_ANIMS = ['attack', 'death'];

function silhouetteIoU(a: QaFrame, b: QaFrame): number {
  let inter = 0, union = 0;
  for (let k = 0; k < a.raster.px.length; k++) {
    const x = a.raster.px[k] !== 0, y = b.raster.px[k] !== 0;
    if (x && y) inter++;
    if (x || y) union++;
  }
  return union ? inter / union : 1;
}

const ROT_TRIES = [45, 90, 135, 180, -45, -90, -135];
const ROT_MATCH_MIN = 0.6;

/** 무게중심을 맞춘 두 실루엣의 IoU, a는 θ도 돌려서(최근접) — 통째 회전 감지용 */
function rotatedIoU(a: QaFrame, b: QaFrame, deg: number): number {
  const ca = centroid(a), cb = centroid(b);
  const { w, h } = b.raster;
  const rad = (-deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  let inter = 0, union = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cb[0], dy = y - cb[1];
    const sx = Math.round(ca[0] + dx * c - dy * s), sy = Math.round(ca[1] + dx * s + dy * c);
    const inA = sx >= 0 && sy >= 0 && sx < a.raster.w && sy < a.raster.h && a.raster.px[sy * a.raster.w + sx] !== 0;
    const inB = b.raster.px[y * w + x] !== 0;
    if (inA && inB) inter++;
    if (inA || inB) union++;
  }
  return union ? inter / union : 0;
}

function centroid(f: QaFrame): [number, number] {
  const { w, px } = f.raster;
  let n = 0, sx = 0, sy = 0;
  for (let k = 0; k < px.length; k++) if (px[k]) { n++; sx += k % w; sy += Math.floor(k / w); }
  return n ? [sx / n, sy / n] : [0, 0];
}

/** rest를 돌린 그림과 가장 잘 맞는 각도(돌리지 않은 것보다 잘 맞고 IoU ≥ ROT_MATCH_MIN일 때), 아니면 0 */
function wholeRotation(rest: QaFrame, f: QaFrame): number {
  let best = 0, bestIoU = Math.max(ROT_MATCH_MIN, rotatedIoU(rest, f, 0));
  for (const d of ROT_TRIES) { const v = rotatedIoU(rest, f, d); if (v > bestIoU) { bestIoU = v; best = d; } }
  return Math.abs(best);
}

/**
 * anim.pose-distinct: attack·death의 연속 키 프레임 실루엣 IoU ≤ poseDistinctMax(같은 그림 반복 방지).
 * frames 모드 death는 rest를 deathRotateMax보다 크게 돌린 그림이면 실패(통째 회전 대신 쓰러지는 단계를 그린다).
 * 판정은 rest를 45° 간격으로 돌려 맞춰 본다 — 주축 각도는 정사각에 가까운 실루엣(큰 귀)에서 흔들린다.
 */
export function animPoseDistinct(frames: readonly QaFrame[], ctx: QaContext): Check {
  const { poseDistinctMax: max, deathRotateMax } = ctx.rules;
  let worst = 0, frame: number | undefined, note = '';
  for (const anim of POSE_ANIMS) {
    const keys = frames.map((f, i) => ({ f, i })).filter(({ f }) => f.anim === anim && f.key !== false);
    for (let j = 1; j < keys.length; j++) {
      const a = keys[j - 1], b = keys[j];
      if (!a || !b) continue;
      const iou = silhouetteIoU(a.f, b.f);
      if (iou > worst) { worst = iou; frame = b.i; note = `${a.f.name}→${b.f.name} IoU ${Math.round(iou * 1000) / 1000}`; }
    }
  }
  const rest = frames[0];
  if (ctx.mode === 'frames' && rest) {
    frames.forEach((f, i) => {
      if (f.anim !== 'death') return;
      const d = wholeRotation(rest, f);
      // 통째 회전은 IoU와 무관한 실패라 값 1로 올리고, 이 실패의 프레임·설명으로 바꾼다(첫 회전 실패만)
      if (d > deathRotateMax && worst <= max) { worst = 1; frame = i; note = `${f.name} 통째 회전 ${Math.round(d)}° > ${deathRotateMax}°`; }
    });
  }
  return check('anim.pose-distinct', true, worst <= max, Math.round(worst * 1000) / 1000, max, { ...(frame !== undefined ? { frame } : {}), ...(note ? { note } : {}) });
}
