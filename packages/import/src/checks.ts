import type { IndexFrame } from './align.js';
import type { ImportResult } from './pipeline.js';

/** import QA 한 항목(경고만 — required 아님). cli가 qa.json 검사 목록에 더한다 */
export interface ImportCheck {
  id: string;
  pass: boolean;
  value: number | null;
  threshold: number;
  note?: string;
}

/** 실루엣의 몸 기준점: 불투명 칸의 무게중심 x, 가장 위 줄 y */
function bodyPoint(f: IndexFrame): [number, number] {
  let sx = 0, n = 0, top = -1;
  for (let k = 0; k < f.px.length; k++) {
    if (!f.px[k]) continue;
    const x = k % f.w, y = (k - x) / f.w;
    sx += x; n++;
    if (top < 0) top = y;
  }
  return [n ? sx / n : 0, top];
}

/**
 * import.jitter: 발 앵커로 맞춘 idle 연속 프레임 사이 몸 기준점(무게중심 x·머리 꼭대기 y) 이동 > max px면 경고.
 * 발은 정렬로 고정되므로, 원본에서 몸이 따로 떨리던 것(AI 생성 위치 흔들림)이 여기서 드러난다.
 */
export function jitterCheck(r: ImportResult, anim = 'idle', max = 1): ImportCheck {
  let worst = 0, at = '';
  const groups = new Map<string, IndexFrame[]>();
  for (const f of r.frames) if (f.anim === anim) groups.set(f.dir, [...(groups.get(f.dir) ?? []), f.frame]);
  for (const [dir, fs] of groups) for (let i = 1; i < fs.length; i++) {
    const a = bodyPoint(fs[i - 1] as IndexFrame), b = bodyPoint(fs[i] as IndexFrame);
    const d = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    if (d > worst) { worst = d; at = `${anim}_${dir}_${i - 1}→${i}`; }
  }
  return { id: 'import.jitter', pass: worst <= max, value: Math.round(worst * 100) / 100, threshold: max, ...(worst > max ? { note: `${at} ${Math.round(worst * 10) / 10}px` } : {}) };
}

/** import.palette-delta: 양자화 전후 평균 OKLab ΔE > max면 경고(색 뭉개짐) */
export function paletteDeltaCheck(r: ImportResult, max = 0.06): ImportCheck {
  return { id: 'import.palette-delta', pass: r.paletteDelta <= max, value: Math.round(r.paletteDelta * 10000) / 10000, threshold: max };
}

/**
 * import.identity: 프레임마다 팔레트 히스토그램(비율), 칸별 중앙값 히스토그램과의 거리(절반 L1).
 * 한 프레임만 기준(max, 중앙값의 3배 중 큰 값)을 넘으면 "다른 캐릭터처럼 생성된 프레임"(AI 생성 드리프트) 경고.
 */
export function identityCheck(r: ImportResult, max = 0.25): ImportCheck {
  const n = r.palette.length + 1;
  const hists = r.frames.map((f) => {
    const h = new Float64Array(n);
    let c = 0;
    for (const v of f.frame.px) if (v) { h[v] = (h[v] ?? 0) + 1; c++; }
    return h.map((x) => (c ? x / c : 0));
  });
  // 기준 = 칸별 중앙값 히스토그램(튀는 프레임 자신이 기준을 끌어당기지 않게)
  const med = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const col = hists.map((h) => h[k] ?? 0).sort((a, b) => a - b);
    med[k] = col[Math.floor(col.length / 2)] ?? 0;
  }
  const dist = hists.map((h) => {
    let d = 0;
    for (let k = 0; k < n; k++) d += Math.abs((h[k] ?? 0) - (med[k] ?? 0));
    return d / 2;
  });
  const sorted = [...dist].sort((a, b) => a - b);
  const limit = Math.max(max, 3 * (sorted[Math.floor(sorted.length / 2)] ?? 0));
  const bad = dist.flatMap((d, i) => (d > limit ? [`${r.frames[i]?.anim}_${r.frames[i]?.dir}_${r.frames[i]?.index}`] : []));
  const worst = sorted[sorted.length - 1] ?? 0;
  return { id: 'import.identity', pass: bad.length === 0, value: Math.round(worst * 1000) / 1000, threshold: Math.round(limit * 1000) / 1000, ...(bad.length ? { note: `다른 캐릭터처럼 보이는 프레임: ${bad.join(', ')}` } : {}) };
}

/** import QA 묶음 + 처리 경고(import.clipped 등)를 검사 항목으로 */
export function importChecks(r: ImportResult): ImportCheck[] {
  const fromWarnings = r.warnings.map((w): ImportCheck => ({ id: w.id, pass: false, value: null, threshold: 0, note: w.note }));
  return [paletteDeltaCheck(r), jitterCheck(r), identityCheck(r), ...fromWarnings];
}
