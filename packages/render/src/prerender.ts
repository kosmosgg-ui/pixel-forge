import { ForgeError, mergeSmallClustersInPlace, parseHex, SPECIAL_EYE, SPECIAL_EYE_COLOR, SPECIAL_OUTLINE, srgbToOklab, type IndexedRaster, type Lab } from '@pixel-forge/core';
import { assertFrame } from './assert.js';
import { fitBudgetInPlace } from './budget-fit.js';
import { createFrameZone, type FrameZone } from './frame-zone.js';
import { outerOutlineInPlace } from './outline.js';
import type { AnimFrame, AnimRender } from './render-anim.js';
import { applySpecialsInPlace, noFit, rampsOf, type RenderContext, type RenderMeta, type RenderResult } from './render-frame.js';
import { resolveZone } from './resolve.js';

/** Blender 패스 1장(render3d가 PNG에서 읽어 준다). 해상도 = 캔버스 × supersample */
export interface PassFrame {
  anim: string;
  /** 방향 이름(s·se·e·…) */
  dir: string;
  index: number;
  ms: number;
  /** 픽셀별 모델 재질 번호(1부터, 0 = 빈칸) */
  mat: Uint8Array;
  /** 픽셀별 오브젝트 번호(1부터) */
  obj: Uint8Array;
  /** 화면 공간 법선(x 오른쪽, y 아래, z 보는 사람 쪽) × 127 */
  normal: Int8Array;
  /** 알베도 sRGB (r, g, b) — 팔레트형 텍스처 색 영역 매핑용 */
  albedo: Uint8Array;
  /** 오브젝트별 변환 키(같으면 앞 프레임과 그대로인 오브젝트, 스키닝 메시는 매번 다른 값) */
  transforms: number[];
}

export interface PrerenderPasses {
  supersample: number;
  /** 모델 재질 이름(번호 n = materials[n-1]) */
  materials: string[];
  /** 오브젝트 이름(번호 n = objects[n-1] — 파츠 레이어 id) */
  objects: string[];
  frames: PassFrame[];
}

export interface PrerenderOptions {
  /** 모델 재질 이름 → 바이블 재질 | "@eye" | "@eye:<재질>:<단계>" | "@outline" | "@palette"(palette 표로) */
  materialMap: Readonly<Record<string, string>>;
  /** 팔레트형 텍스처: 모델 재질 → 견본 색 표. 알베도와 OKLab으로 가장 가까운 견본의 대상으로 */
  palette?: Readonly<Record<string, readonly { hex: string; to: string }[]>>;
  /** rule: prerender.toon — n·L 경계 [어둠|기본, 기본|밝음] → 3단계 */
  toon: readonly [number, number];
}

/** base = 이 색의 기준 램프 단계(같은 바이블 재질로 묶인 원본 색의 명도 순위), 없으면 램프 가운데 */
interface Target { mat: number; special: number; step?: number; base?: number }

/**
 * rule: prerender.toon — POC와 같은 3단계 툰(사용자 승인 P7): n·L > 0.45 밝음, > −0.1 중간, 나머지 어둠.
 * 기준 단계(원본 명도 순위) 위에서 어둠 −1 · 중간 0 · 밝음 +1, 램프 범위로 자른다.
 */
const toonStep = (level: number, base: number, steps: number): number => Math.max(0, Math.min(steps - 1, base + level - 1));

/** "metal" | "@eye" | "@eye:gold:3" | "@outline" → zone 값. "@eye"(검은 눈)·"@outline"(틈·구멍)의 재질은 실루엣용 아무 재질(색은 외곽선색으로 덮는다) */
function parseTarget(t: string, names: readonly string[], where: string): Target {
  if (t === '@eye') return { mat: 1, special: SPECIAL_EYE };
  if (t === '@outline') return { mat: 1, special: SPECIAL_OUTLINE };
  const [mat = '', step] = t.replace(/^@eye:/, '').split(':');
  const id = names.indexOf(mat) + 1;
  if (!id) throw new ForgeError('spec.refs', `materials.json ${where}: 바이블에 없는 재질 ${mat}`);
  return t.startsWith('@eye:') ? { mat: id, special: SPECIAL_EYE_COLOR, step: Number(step ?? 0) } : { mat: id, special: 0 };
}

/** 모델 재질 번호 + 알베도 → 대상. 팔레트 표는 색마다 한 번만 계산(Map) */
interface Classifier { at: (mi: number, r: number, g: number, b: number) => Target | null; eyeStep: Map<number, number> }

/**
 * 명도 순서 보존(사용자 승인 P7): 같은 바이블 재질로 가는 견본 색들을 OKLab 명도 순으로 램프 단계에 고르게 배치
 * (가장 어두운 견본 = 0, 가장 밝은 = 맨 끝). 견본이 하나면 가운데.
 */
function rankBasesInPlace(entries: readonly { lab: Lab; t: Target }[], stepsOf: (m: number) => number): void {
  const byMat = new Map<number, { lab: Lab; t: Target }[]>();
  for (const e of entries) if (!e.t.special) byMat.set(e.t.mat, [...(byMat.get(e.t.mat) ?? []), e]);
  for (const [m, list] of byMat) {
    const n = stepsOf(m);
    const sorted = [...list].sort((a, b) => a.lab.L - b.lab.L);
    sorted.forEach((e, i) => { e.t.base = sorted.length === 1 ? Math.floor((n - 1) / 2) : Math.round((i * (n - 1)) / (sorted.length - 1)); });
  }
}

function classifier(ctx: RenderContext, passes: PrerenderPasses, o: PrerenderOptions): Classifier {
  const names = Object.keys(ctx.bible.materials).sort();
  const ramps = rampsOf(ctx.bible, ctx.palette);
  const stepsOf = (m: number) => ramps[m - 1]?.indices.length ?? 1;
  const fixed: (Target | null)[] = [null];
  const tables: ({ lab: Lab; t: Target }[] | null)[] = [null];
  for (const m of passes.materials) {
    const v = o.materialMap[m];
    const table = v === '@palette' || (v === undefined && o.palette?.[m]) ? o.palette?.[m] : undefined;
    if (table) {
      const entries = table.map((e) => { const [r, g, b] = parseHex(e.hex); return { lab: srgbToOklab(r, g, b), t: parseTarget(e.to, names, `palette.${m}`) }; });
      rankBasesInPlace(entries, stepsOf);
      tables.push(entries);
      fixed.push(null);
    } else {
      tables.push(null);
      fixed.push(v === undefined ? null : parseTarget(v, names, `map.${m}`));
    }
  }
  const memo = new Map<number, Target>();
  const eyeStep = new Map<number, number>();
  for (const t of [...fixed, ...tables.flatMap((tb) => (tb ?? []).map((e) => e.t))]) if (t?.special === SPECIAL_EYE_COLOR) eyeStep.set(t.mat, t.step ?? 0);
  const at = (mi: number, r: number, g: number, b: number): Target | null => {
    const f = fixed[mi];
    if (f) return f;
    const table = tables[mi];
    if (!table) return null;
    const key = mi * 16777216 + (r << 16) + (g << 8) + b;
    const hit = memo.get(key);
    if (hit) return hit;
    const lab = srgbToOklab(r, g, b);
    let best = table[0], bestD = Infinity;
    for (const e of table) { const d = (e.lab.L - lab.L) ** 2 + (e.lab.a - lab.a) ** 2 + (e.lab.b - lab.b) ** 2; if (d < bestD) { bestD = d; best = e; } }
    const t = best?.t ?? null;
    if (t) memo.set(key, t);
    return t;
  };
  return { at, eyeStep };
}

const sizeOf = (ctx: RenderContext): [number, number] => {
  const size = ctx.bible.sizeClasses[ctx.spec.sizeClass];
  if (!size) throw new ForgeError('spec.refs', `바이블에 없는 sizeClass: ${ctx.spec.sizeClass}`);
  return size;
};

/** key = (((재질 × 16 + 기준 단계 + 1) × 4 + 특수) × 4 + 툰) × 256 + 오브젝트 — 기준 단계 없음 = 0 */
const pack = (t: Target, level: number, obj: number) => ((((t.mat * 16 + (t.base ?? -1) + 1) * 4 + t.special) * 4 + level) * 256) + obj;

/**
 * supersample 블록 다수결로 1배 zone: 블록 안 불투명 칸이 절반 이상일 때만 칠하고, (재질, 특수, 툰, 오브젝트)가 가장 많은 값.
 * 눈 칸이 하나라도 있으면 눈이 이긴다(작은 눈구멍이 다수결에 지워지지 않게). 동률은 키가 작은 쪽(결정론).
 */
function downscale(ctx: RenderContext, f: PassFrame, s: number, classify: Classifier, o: PrerenderOptions, stepsOf: (m: number) => number): FrameZone {
  const [W, H] = sizeOf(ctx);
  const z = createFrameZone(W, H);
  const L = ctx.bible.light.dir, len = Math.hypot(...L) || 1;
  const counts = new Map<number, number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    counts.clear();
    let opaque = 0, eye = -1;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const k = (y * s + j) * W * s + x * s + i;
      const t = classify.at(f.mat[k] ?? 0, f.albedo[k * 3] ?? 0, f.albedo[k * 3 + 1] ?? 0, f.albedo[k * 3 + 2] ?? 0);
      if (!t) continue;
      opaque++;
      const lam = ((f.normal[k * 3] ?? 0) * L[0] + (f.normal[k * 3 + 1] ?? 0) * L[1] + (f.normal[k * 3 + 2] ?? 0) * L[2]) / (127 * len);
      const key = pack(t, lam > o.toon[1] ? 2 : lam > o.toon[0] ? 1 : 0, f.obj[k] ?? 0);
      if ((t.special === SPECIAL_EYE || t.special === SPECIAL_EYE_COLOR) && (eye < 0 || key < eye)) eye = key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (opaque * 2 < s * s && eye < 0) continue;
    let best = eye, bestN = 0;
    if (best < 0) for (const [key, n] of counts) if (n > bestN || (n === bestN && key < best)) { best = key; bestN = n; }
    const q = y * W + x, obj = best % 256, level = Math.floor(best / 256) % 4, special = Math.floor(best / 1024) % 4;
    const base = (Math.floor(best / 4096) % 16) - 1, m = Math.floor(best / 65536);
    z.material[q] = m;
    z.special[q] = special;
    const n = stepsOf(m);
    const step = special === SPECIAL_EYE_COLOR ? classify.eyeStep.get(m) ?? 0 : toonStep(level, base >= 0 ? base : Math.floor((n - 1) / 2), n);
    z.shade[q] = z.fixed[q] = Math.min(step, stepsOf(m) - 1);
    z.part[q] = obj;
    z.depth[q] = 1;
    z.normal[q * 3 + 2] = 127;
    z.lit[q] = level / 2;
  }
  return z;
}

/** zone → 정리(작은 음영 섬 병합) → 해석 → 외곽선 → 눈. 색 예산은 전 프레임을 모은 뒤 함께 맞춘다 */
function finish(ctx: RenderContext, z: FrameZone, transforms: readonly number[]): RenderResult {
  const { bible, rules, palette, spec } = ctx;
  const ramps = rampsOf(bible, palette);
  mergeSmallClustersInPlace(z, rules.cleanup.minCluster);
  const raster: IndexedRaster = resolveZone(z, ramps);
  const protect = new Uint8Array(z.w * z.h);
  // 크기 등급에 외곽선 설정이 있으면 그것, 없으면 POC와 같은 1px 어두운 단색(selout의 밝은 쪽 0단계는 3D 축소 경계에서 외곽선이 없는 듯 보인다)
  const mode = bible.sizeClassOptions[spec.sizeClass]?.outline ?? 'dark';
  outerOutlineInPlace(raster, z, ramps, { mode, globalIndex: palette.outlineIndex, litThreshold: rules.outline.seloutLitThreshold }, protect);
  const eyes = applySpecialsInPlace(raster, z, palette.outlineIndex, protect);
  const exclude = [...new Set([...ramps.map((r) => r.outline), palette.outlineIndex, ...palette.fxIndices])];
  const meta: RenderMeta = {
    budget: noFit(raster, bible.colorBudget[spec.sizeClass] ?? Infinity), budgetExclude: exclude, eyes, smallParts: [], face: null,
    layers: { material: z.material, part: z.part, mark: protect },
    partTransforms: transforms.map((t) => [t, 0, 0]), warnings: [],
  };
  // 카메라를 전 프레임 범위로 맞춰 잘림이 없다(넘침은 bounds.canvas가 잡는다)
  return { raster, origin: [Math.floor(z.w / 2), z.h - 1], clipped: 0, meta };
}

/** 프레임 1장의 눈 픽셀 수(방향 고르기용, 색 예산 전) */
export function prerenderEyeCount(ctx: RenderContext, passes: PrerenderPasses, f: PassFrame, o: PrerenderOptions): number {
  const ramps = rampsOf(ctx.bible, ctx.palette);
  const z = downscale(ctx, f, passes.supersample, classifier(ctx, passes, o), o, (m) => ramps[m - 1]?.indices.length ?? 1);
  return z.special.reduce((a, v) => a + (v === SPECIAL_EYE || v === SPECIAL_EYE_COLOR ? 1 : 0), 0);
}

/**
 * 프리렌더 패스 → rest + 애니 프레임(방향별). rest = 첫 패스 프레임(첫 애니·첫 방향·첫 프레임).
 * 좌우 반전 없이 방향마다 따로 렌더한 프레임을 그대로 쓴다(AnimFrame.dir).
 */
export function renderPrerender(ctx: RenderContext, passes: PrerenderPasses, o: PrerenderOptions): AnimRender {
  const classify = classifier(ctx, passes, o);
  const used = new Set<number>();
  for (const f of passes.frames) for (const v of f.mat) used.add(v);
  const missing = passes.materials.filter((m, i) => used.has(i + 1) && o.materialMap[m] === undefined && !o.palette?.[m]);
  if (missing.length) throw new ForgeError('spec.refs', `materials.json에 모델 재질 매핑이 없습니다: ${missing.join(', ')}`);
  const ramps = rampsOf(ctx.bible, ctx.palette);
  const stepsOf = (m: number) => ramps[m - 1]?.indices.length ?? 1;
  if (!passes.frames.length) throw new ForgeError('render3d.empty', '프리렌더 패스에 프레임이 없습니다');
  const results = passes.frames.map((f) => finish(ctx, downscale(ctx, f, passes.supersample, classify, o, stepsOf), f.transforms));
  const exclude = new Set(results.flatMap((r) => [...r.meta.budgetExclude, ...r.meta.eyes.map((k) => r.raster.px[k] ?? 0)]));
  const budget = fitBudgetInPlace(results.map((r) => r.raster), ramps, ctx.palette.palette, ctx.bible.colorBudget[ctx.spec.sizeClass] ?? Infinity, exclude);
  for (const r of results) { r.meta.budget = budget; assertFrame(r.raster, ctx.palette.palette); }
  const last = new Map(passes.frames.map((f) => [`${f.anim}_${f.dir}`, f.index]));
  const frames = passes.frames.map((f, i): AnimFrame => {
    const r = results[i] as RenderResult;
    return {
      anim: f.anim, dir: f.dir, index: f.index, raster: r.raster, ms: f.ms, hold: f.anim === 'death' && last.get(`${f.anim}_${f.dir}`) === f.index,
      // 발 위치는 모델 애니가 정한다(축소 다수결로 1px 흔들릴 수 있음) — 발밑 고정 검사 대상은 rest만
      keyName: `f${f.index}`, inbetween: false, rootFixed: false, clipped: r.clipped, meta: r.meta,
    };
  });
  const rest = results[0] as RenderResult;
  return { rest: { ...rest, raster: { ...rest.raster, px: rest.raster.px.slice() } }, frames, budget };
}
