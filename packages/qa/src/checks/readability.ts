import { srgbToOklab } from '@pixel-forge/core';
import { check, type Check, type QaContext, type QaFrame } from '../types.js';


/** read.contrast: 실루엣(불투명 픽셀) 평균 명도와 바이블 배경 명도의 차 ≥ contrastMinL (OKLab L) */
export function readContrast(frames: readonly QaFrame[], ctx: QaContext): Check {
  const bg = srgbToOklab(...ctx.background).L;
  // 팔레트 인덱스별 L을 한 번만 계산 (픽셀 루프에서 객체를 만들지 않는다)
  const L = Float64Array.from(ctx.palette.colors, (c) => srgbToOklab(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255).L);
  let sum = 0, n = 0;
  for (const { raster: r } of frames) for (const v of r.px) {
    if (v && v < L.length) { sum += L[v] ?? 0; n++; }
  }
  const diff = n ? Math.abs(sum / n - bg) : 0;
  return check('read.contrast', false, diff >= ctx.rules.contrastMinL, round(diff), ctx.rules.contrastMinL);
}

/** read.role-color: roleColorKey 재질 픽셀이 불투명 픽셀의 roleColorMin 이상 */
export function readRoleColor(frames: readonly QaFrame[], ctx: QaContext): Check {
  const min = ctx.rules.roleColorMin;
  if (!ctx.roleIndices) return check('read.role-color', false, true, null, min, { note: 'role 없음' });
  let role = 0, all = 0;
  for (const { raster: r } of frames) for (const v of r.px) if (v) { all++; if (ctx.roleIndices.has(v)) role++; }
  const ratio = all ? role / all : 0;
  return check('read.role-color', false, ratio >= min, round(ratio), min);
}

/** form.face-clear: 머리 뼈 파츠 면적 중 다른 파츠에 가려진 비율 ≤ faceCoverMax */
export function formFaceClear(frames: readonly QaFrame[], ctx: QaContext): Check {
  const max = ctx.rules.faceCoverMax;
  let area = 0, covered = 0;
  for (const f of frames) if (f.face) { area += f.face.area; covered += f.face.covered; }
  if (!area) return check('form.face-clear', false, true, null, max, { note: 'eyes(머리 뼈) 없음' });
  const ratio = covered / area;
  return check('form.face-clear', false, ratio <= max, round(ratio), max);
}

/** form.detail-min: 같은 재질 8-연결 영역(1px 대각선 획도 한 조각) 중 detailMinPx 미만 조각 수 ≤ detailMaxCount (mark 위치 제외) */
export function formDetailMin(frames: readonly QaFrame[], ctx: QaContext): Check {
  const { detailMinPx, detailMaxCount } = ctx.rules;
  const where: [number, number][] = [];
  for (const { raster: r, material, mark } of frames) {
    if (!material) continue;
    const seen = new Uint8Array(material.length);
    for (let k = 0; k < material.length; k++) {
      if (!material[k] || mark?.[k] || seen[k]) continue;
      const m = material[k];
      const stack = [k];
      seen[k] = 1;
      let size = 0;
      while (stack.length) {
        const j = stack.pop() ?? 0, x = j % r.w, y = (j - x) / r.w;
        size++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, n = Y * r.w + X;
          if (X >= 0 && Y >= 0 && X < r.w && Y < r.h && !seen[n] && !mark?.[n] && material[n] === m) { seen[n] = 1; stack.push(n); }
        }
      }
      if (size < detailMinPx) where.push([k % r.w, Math.floor(k / r.w)]);
    }
  }
  return check('form.detail-min', false, where.length <= detailMaxCount, where.length, detailMaxCount, where.length ? { where } : {});
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
