import { createIndexed, ForgeError, type IndexedRaster } from '@pixel-forge/core';

/** 한 줄(방향)의 한 애니: 고유 프레임 + 원래 순서(frameMap — 중복 제거 전 열 수를 되살린다) */
export interface RowAnim {
  anim: string;
  dir: string;
  unique: readonly IndexedRaster[];
  order: readonly number[];
}

/** 애니 순서 + 재생 메타(열은 이 순서로 연속) */
export interface RowAnimMeta {
  name: string;
  fps: number;
  loop?: boolean;
  /** 걷기 한 걸음 길이(1배 px) — 게임이 이동 속도에 재생 속도를 맞춘다(G1 3.3b) */
  stride_px?: number;
}

export interface RowSheetInput {
  cell: { w: number; h: number };
  /** 시트 행 순서(이름 ↔ 방향). 가져온 프레임이 없는 방향은 행에서 뺀다 */
  rows: readonly { name: string; dir: string }[];
  anims: readonly RowAnimMeta[];
  frames: readonly RowAnim[];
}

export interface RowAnimEntry { start_column: number; frames: number; fps: number; loop?: boolean; stride_px?: number; rowNames: string[] }

export interface RowLayout {
  columns: number;
  rows: { name: string; dir: string }[];
  animations: Record<string, RowAnimEntry>;
}

export interface RowSheet extends Omit<RowLayout, 'rows'> {
  sheet: IndexedRaster;
  rows: string[];
}

/** 행·열 배치만(픽셀 없음) — 팔레트가 다른 여러 원본을 합칠 때(cli가 RGBA로 붙인다)도 같은 배치를 쓴다 */
export function rowSheetLayout(rows: RowSheetInput['rows'], anims: readonly RowAnimMeta[], parts: readonly { anim: string; dir: string; count: number }[]): RowLayout {
  const used = rows.filter((r) => parts.some((f) => f.dir === r.dir));
  const animations: Record<string, RowAnimEntry> = {};
  let col = 0;
  for (const a of anims) {
    const mine = parts.filter((f) => f.anim === a.name);
    const n = Math.max(0, ...mine.map((f) => f.count));
    if (!n) continue;
    const rowNames = used.filter((r) => mine.some((f) => f.dir === r.dir)).map((r) => r.name);
    animations[a.name] = { start_column: col, frames: n, fps: a.fps, ...(a.loop !== undefined ? { loop: a.loop } : {}), ...(a.stride_px !== undefined ? { stride_px: a.stride_px } : {}), rowNames };
    col += n;
  }
  return { columns: col, rows: used, animations };
}

// 근거: 게임이 제공한 형식 — docs/integrated/P8/samples/seonggeom_sera_manifest.json(복사본 __fixtures__/) + G1 지시 3.2 확장. 엔진 공식 형식이 아니라 게임 자체 계약
/** 행 = 방향, 열 = 애니 프레임 연속(godot-rowsheet). 셀 크기가 다른 프레임은 오류(셀 맞춤은 import가 이미 했다) */
export function rowSheet(c: RowSheetInput): RowSheet {
  const layout = rowSheetLayout(c.rows, c.anims, c.frames.map((f) => ({ anim: f.anim, dir: f.dir, count: f.order.length })));
  const sheet = createIndexed(layout.columns * c.cell.w, layout.rows.length * c.cell.h);
  layout.rows.forEach((r, ry) => {
    for (const f of c.frames.filter((g) => g.dir === r.dir)) {
      const start = layout.animations[f.anim]?.start_column ?? 0;
      f.order.forEach((u, i) => {
        const src = f.unique[u];
        if (!src) return;
        if (src.w !== c.cell.w || src.h !== c.cell.h) throw new ForgeError('export.cell', `셀 크기가 다릅니다: ${f.anim}_${f.dir}_${u} ${src.w}×${src.h}`);
        for (let y = 0; y < src.h; y++) sheet.px.set(src.px.subarray(y * src.w, (y + 1) * src.w), (ry * c.cell.h + y) * sheet.w + (start + i) * c.cell.w);
      });
    }
  });
  return { sheet, columns: layout.columns, rows: layout.rows.map((r) => r.name), animations: layout.animations };
}

/** provenance 11개 필드(게임 provenanceFields 이름과 같게) */
export interface Provenance {
  assetId: string;
  creator: string;
  sourceUrl: string;
  license: string;
  aiUsed: boolean;
  promptRecord: string;
  editedBy: string;
  sourceFile: string;
  exportFile: string;
  rightsReviewed: boolean;
  creditText: string;
}

export interface RowManifestInput {
  assetId: string;
  version: string;
  source: string;
  /** 시트 배치 + 픽셀 크기(색 변환·붙이기는 호출자) */
  sheet: { w: number; h: number; columns: number; rows: readonly string[]; animations: Readonly<Record<string, RowAnimEntry>> };
  cell: { w: number; h: number };
  directions: Readonly<Record<string, { row: string; flip_h: boolean }>>;
  anchor: readonly [number, number];
  /** 게임 화면 정수 배율(바이블 display.spriteScale) */
  displayScale: number;
  notes: readonly string[];
  provenance: Provenance;
  qa: { pass: boolean; warnings: readonly { id: string; note?: string }[] };
}

/** 게임 방향 → 행 번호(반전 없는 방향만), 반전 방향 → 같은 행을 쓰는 원래 방향(G1 3.2 rows·mirror) */
function directionMaps(m: RowManifestInput) {
  const directions: Record<string, { row: number; flip_h: boolean }> = {}, rows: Record<string, number> = {}, mirror: Record<string, string> = {};
  for (const [name, d] of Object.entries(m.directions)) {
    const row = m.sheet.rows.indexOf(d.row);
    if (row < 0) continue;
    directions[name] = { row, flip_h: d.flip_h };
    if (!d.flip_h) rows[name] = row;
  }
  for (const [name, d] of Object.entries(m.directions)) {
    if (!d.flip_h || !(name in directions)) continue;
    const base = Object.entries(rows).find(([, r]) => r === directions[name]?.row)?.[0];
    if (base) mirror[name] = base;
  }
  return { directions, rows, mirror };
}

/**
 * 게임이 읽는 매니페스트: G1 지시 3.2 형식(assetId·anchor [x,y]·display_scale·rows 방향→행·mirror·animations loop/stride_px/rows_only)
 * + 이전 샘플(samples/seonggeom_sera_manifest.json) 키(directions·columns·notes, 행 이름 row_names·앵커 문장 anchor_text) + provenance + qa.
 * quality는 항상 "candidate" — 게임 쪽 Gate C 통과 전 다른 값 금지(사용자 승인 P8).
 */
export function godotRowManifest(m: RowManifestInput) {
  const { directions, rows, mirror } = directionMaps(m);
  const animations = Object.fromEntries(Object.entries(m.sheet.animations).map(([name, a]) => {
    const only = a.rowNames.length < m.sheet.rows.length ? Object.entries(rows).filter(([, r]) => a.rowNames.includes(m.sheet.rows[r] ?? '')).map(([d]) => d) : [];
    return [name, { start_column: a.start_column, frames: a.frames, fps: a.fps, loop: a.loop ?? false, ...(a.stride_px !== undefined ? { stride_px: a.stride_px } : {}), ...(only.length ? { rows_only: only } : {}) }];
  }));
  return {
    assetId: m.assetId, version: m.version, quality: 'candidate' as const, source: m.source,
    frame_size: [m.cell.w, m.cell.h], sheet_size: [m.sheet.w, m.sheet.h], anchor: [m.anchor[0], m.anchor[1]], display_scale: m.displayScale,
    columns: m.sheet.columns, rows, mirror, directions, animations,
    row_names: [...m.sheet.rows], anchor_text: `foot-center, (${m.anchor[0]},${m.anchor[1]})`, notes: [...m.notes],
    provenance: m.provenance, qa: { pass: m.qa.pass, warnings: m.qa.warnings.map((w) => ({ id: w.id, ...(w.note ? { note: w.note } : {}) })) },
  };
}
