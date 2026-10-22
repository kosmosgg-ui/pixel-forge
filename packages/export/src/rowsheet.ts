import { createIndexed, ForgeError, type IndexedRaster } from '@pixel-forge/core';

/** 한 줄(방향)의 한 애니: 고유 프레임 + 원래 순서(frameMap — 중복 제거 전 열 수를 되살린다) */
export interface RowAnim {
  anim: string;
  dir: string;
  unique: readonly IndexedRaster[];
  order: readonly number[];
}

export interface RowSheetInput {
  cell: { w: number; h: number };
  /** 시트 행 순서(이름 ↔ 방향). 가져온 프레임이 없는 방향은 행에서 뺀다 */
  rows: readonly { name: string; dir: string }[];
  /** 애니 순서 + fps(열은 이 순서로 연속) */
  anims: readonly { name: string; fps: number }[];
  frames: readonly RowAnim[];
}

export interface RowSheet {
  sheet: IndexedRaster;
  columns: number;
  rows: string[];
  animations: Record<string, { start_column: number; frames: number; fps: number }>;
}

// 근거: 게임이 제공한 형식 원본 docs/integrated/P8/samples/seonggeom_sera_manifest.json(복사본 __fixtures__/) — 엔진 공식 형식이 아니라 게임 자체 계약
/** 행 = 방향, 열 = 애니 프레임 연속(godot-rowsheet). 셀 크기가 다른 프레임은 오류(셀 맞춤은 import가 이미 했다) */
export function rowSheet(c: RowSheetInput): RowSheet {
  const rows = c.rows.filter((r) => c.frames.some((f) => f.dir === r.dir));
  const animations: RowSheet['animations'] = {};
  let col = 0;
  for (const a of c.anims) {
    const n = Math.max(0, ...c.frames.filter((f) => f.anim === a.name).map((f) => f.order.length));
    if (!n) continue;
    animations[a.name] = { start_column: col, frames: n, fps: a.fps };
    col += n;
  }
  const sheet = createIndexed(col * c.cell.w, rows.length * c.cell.h);
  rows.forEach((r, ry) => {
    for (const f of c.frames.filter((g) => g.dir === r.dir)) {
      const start = animations[f.anim]?.start_column ?? 0;
      f.order.forEach((u, i) => {
        const src = f.unique[u];
        if (!src) return;
        if (src.w !== c.cell.w || src.h !== c.cell.h) throw new ForgeError('export.cell', `셀 크기가 다릅니다: ${f.anim}_${f.dir}_${u} ${src.w}×${src.h}`);
        for (let y = 0; y < src.h; y++) sheet.px.set(src.px.subarray(y * src.w, (y + 1) * src.w), (ry * c.cell.h + y) * sheet.w + (start + i) * c.cell.w);
      });
    }
  });
  return { sheet, columns: col, rows: rows.map((r) => r.name), animations };
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
  version: string;
  source: string;
  sheet: RowSheet;
  cell: { w: number; h: number };
  directions: Readonly<Record<string, { row: string; flip_h: boolean }>>;
  anchor: readonly [number, number];
  notes: readonly string[];
  provenance: Provenance;
  qa: { pass: boolean; warnings: readonly { id: string; note?: string }[] };
}

/**
 * 게임이 읽는 매니페스트(samples/seonggeom_sera_manifest.json과 같은 키 구조 + provenance + qa).
 * quality는 항상 "candidate" — 게임 쪽 Gate C 통과 전 다른 값 금지(사용자 승인 P8).
 */
export function godotRowManifest(m: RowManifestInput) {
  const directions = Object.fromEntries(Object.entries(m.directions).flatMap(([name, d]) => {
    const row = m.sheet.rows.indexOf(d.row);
    return row < 0 ? [] : [[name, { row, flip_h: d.flip_h }]];
  }));
  return {
    version: m.version, quality: 'candidate' as const, source: m.source,
    frame_size: [m.cell.w, m.cell.h], sheet_size: [m.sheet.sheet.w, m.sheet.sheet.h], columns: m.sheet.columns, rows: m.sheet.rows,
    directions, animations: m.sheet.animations, anchor: `foot-center, (${m.anchor[0]},${m.anchor[1]})`, notes: [...m.notes],
    provenance: m.provenance, qa: { pass: m.qa.pass, warnings: m.qa.warnings.map((w) => ({ id: w.id, ...(w.note ? { note: w.note } : {}) })) },
  };
}
