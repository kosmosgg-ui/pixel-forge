import type { ShadeRules } from '@pixel-forge/spec';
import { AUTO, type FrameZone } from './frame-zone.js';

export interface Light {
  /** 광원을 향하는 방향 (x 오른쪽, y 아래, z 화면 밖) */
  dir: readonly [number, number, number];
  ambient: number;
}

/**
 * rule: form.shade-quantize — 세기 = min(1, ambient + max(0, n·L))를 thresholds로 단계화하고 재질 램프 단계로 옮긴다.
 * rule: form.depth-cue — 뒤쪽 층(depthLayer = back)은 backLimbDarken 단계 어둡게.
 * mask legend로 고정된 shade는 그대로 둔다(램프 범위로만 자름).
 */
export function shadeZoneInPlace(z: FrameZone, light: Light, rules: ShadeRules, stepsOf: (materialId: number) => number): void {
  const len = Math.hypot(...light.dir) || 1;
  const [lx, ly, lz] = light.dir.map((v) => v / len) as [number, number, number];
  const T = rules.thresholds.length;
  for (let k = 0; k < z.material.length; k++) {
    const m = z.material[k] ?? 0;
    if (!m) continue;
    const steps = stepsOf(m);
    const lam = Math.max(0, ((z.normal[k * 3] ?? 0) * lx + (z.normal[k * 3 + 1] ?? 0) * ly + (z.normal[k * 3 + 2] ?? 0) * lz) / 127);
    z.lit[k] = lam;
    const fixed = z.fixed[k] ?? AUTO;
    if (fixed !== AUTO) {
      z.shade[k] = Math.min(fixed, steps - 1);
      continue;
    }
    const intensity = Math.min(1, light.ambient + lam);
    const level = rules.thresholds.filter((t) => intensity >= t).length;
    let step = Math.round((level * (steps - 1)) / T);
    if (z.back[k]) step = Math.max(0, step - rules.backLimbDarken);
    z.shade[k] = step;
  }
}
