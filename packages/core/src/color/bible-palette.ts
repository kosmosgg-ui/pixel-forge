import type { BibleColors, RulesColor } from '@pixel-forge/spec';
import { ForgeError } from '../errors.js';
import { addColor, createPalette, type Palette } from '../palette.js';
import { hexToRgba, parseHex } from './hex.js';
import { srgbToOklab, type Lab, type Lch } from './oklab.js';
import { lchToHex, planRamp, type Ramp } from './ramp.js';

export interface BiblePalette {
  palette: Palette;
  ramps: Record<string, Ramp>;
  outlineIndex: number;
  fxIndices: number[];
}

type Step = number | 'outline';

interface Placed {
  hex: string;
  lab: Lab;
  /** null = 예약 색(외곽선 전역색·fx) */
  material: string | null;
  step: Step | null;
}

const labOfHex = (hex: string): Lab => srgbToOklab(...parseHex(hex));
const dist = (a: Lab, b: Lab): number => Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);

/** 기준색 → 밝은 쪽 바깥→안 → 어두운 쪽 바깥→안 → 외곽선 톤. sign: 충돌 시 L을 옮길 방향 */
function placementOrder(steps: number, mid: number): { step: Step; sign: 1 | -1 }[] {
  const order: { step: Step; sign: 1 | -1 }[] = [{ step: mid, sign: -1 }];
  for (let i = steps - 1; i > mid; i--) order.push({ step: i, sign: -1 });
  for (let i = 0; i < mid; i++) order.push({ step: i, sign: 1 });
  order.push({ step: 'outline', sign: 1 });
  return order;
}

function canShare(bible: BibleColors, a: string, b: string | null): boolean {
  if (b === null || a === b) return false;
  return bible.materials[a]?.shareWith === b || bible.materials[b]?.shareWith === a;
}

/** 같은 램프에서 이미 놓인 이웃 단계의 L 사이 (명도 순서 유지). 외곽선 톤은 ramp[0]보다 어두워야 한다 */
function orderBounds(own: Placed[], step: Step): { lo: number; hi: number } {
  let lo = -Infinity, hi = Infinity;
  for (const p of own) {
    if (typeof p.step !== 'number') continue;
    if (step === 'outline') hi = Math.min(hi, p.lab.L);
    else if (p.step < step) lo = Math.max(lo, p.lab.L);
    else if (p.step > step) hi = Math.min(hi, p.lab.L);
  }
  return { lo, hi };
}

/**
 * 예약 색·이미 놓인 색과 거리 ≥ reservedMinDistance가 될 때까지 L을 조금씩 옮긴다.
 * 옮기다가 같은 램프 이웃 단계를 넘어가면(명도 순서가 깨지면) 더 옮기지 않고 충돌로 본다.
 */
function place(lch: Lch, sign: 1 | -1, material: string, step: Step, placed: Placed[], bible: BibleColors, rules: RulesColor): string {
  const r = rules.ramp;
  const { lo, hi } = orderBounds(placed.filter((p) => p.material === material), step);
  for (let n = 0; ; n++) {
    const hex = lchToHex({ ...lch, L: lch.L + sign * n * r.collisionNudgeL });
    const lab = labOfHex(hex);
    const hit = placed.find((p) => !canShare(bible, material, p.material) && dist(p.lab, lab) < r.reservedMinDistance);
    if (!hit && (lab.L <= lo || lab.L >= hi)) {
      throw new ForgeError('palette.collision', `${material}[${String(step)}] 색을 램프 명도 순서 안에 둘 수 없습니다`, { material, step, hex, lo, hi });
    }
    if (!hit) {
      placed.push({ hex, lab, material, step });
      return hex;
    }
    if (n >= r.collisionMaxNudges) {
      const against = hit.material === null ? `예약 색 ${hit.hex}` : `${hit.material}[${String(hit.step)}]`;
      throw new ForgeError('palette.collision', `${material}[${String(step)}] 색이 ${against}와 너무 가깝습니다`, {
        material, step, hex, against: hit.material ?? 'reserved', againstStep: hit.step, againstHex: hit.hex,
      });
    }
  }
}

/**
 * 순서: 재질 키 정렬 → 각 램프 어두움→밝음 → 그 재질 외곽선 톤 → 전역 외곽선 → 이펙트.
 * shareWith로 묶인 재질끼리만 같은 hex(인덱스 공유)가 나올 수 있다.
 */
export function buildBiblePalette(bible: BibleColors, rules: RulesColor): BiblePalette {
  const reserved = [bible.outline.globalColor, ...bible.fxColors];
  const placed: Placed[] = reserved.map((hex) => ({ hex, lab: labOfHex(hex), material: null, step: null }));
  const ids = Object.keys(bible.materials).sort();
  const hexes: Record<string, { steps: string[]; outline: string }> = {};
  for (const id of ids) {
    const m = bible.materials[id];
    if (!m) continue;
    const contrast = m.contrast ?? rules.materialContrast[m.kind] ?? rules.materialContrast.default;
    const plan = planRamp(m.base, m.steps, contrast, rules.ramp);
    const steps: string[] = [];
    let outline = '';
    for (const { step, sign } of placementOrder(m.steps, plan.mid)) {
      const lch = step === 'outline' ? plan.outline : plan.steps[step];
      if (!lch) continue;
      const hex = place(lch, sign, id, step, placed, bible, rules);
      if (step === 'outline') outline = hex;
      else steps[step] = hex;
    }
    hexes[id] = { steps, outline };
  }
  let palette = createPalette();
  const add = (hex: string, name: string): number => {
    const r = addColor(palette, hexToRgba(hex), name);
    palette = r.palette;
    return r.index;
  };
  const ramps: Record<string, Ramp> = {};
  for (const id of ids) {
    const h = hexes[id];
    if (!h) continue;
    const indices = h.steps.map((hex, i) => add(hex, `${id}.${i}`));
    ramps[id] = { id, indices, outline: add(h.outline, `${id}.outline`) };
  }
  const outlineIndex = add(bible.outline.globalColor, 'outline');
  const fxIndices = bible.fxColors.map((hex, i) => add(hex, `fx.${i}`));
  return { palette, ramps, outlineIndex, fxIndices };
}
