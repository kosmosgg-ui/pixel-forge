import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIndexed } from '@pixel-forge/core';
import { godotRowManifest, rowSheet, type Provenance } from './rowsheet.js';

/** 게임이 읽는 형식 원본(samples/seonggeom_sera_manifest.json 복사본 — 값이 아니라 키 구조를 비교) */
const SAMPLE = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'seonggeom_sera_manifest.json'), 'utf8')) as unknown;

/** 키 구조: 객체는 키별 재귀, 배열은 "[]"+첫 원소 구조, 값은 타입 이름. animations·directions의 이름 키는 하나로 묶는다 */
function shape(v: unknown, path = ''): unknown {
  if (Array.isArray(v)) return ['[]', v.length ? shape(v[0], path) : null];
  if (v !== null && typeof v === 'object') {
    const e = Object.entries(v);
    if (path === 'animations' || path === 'directions') return { '<name>': shape(e[0]?.[1], `${path}.*`) };
    return Object.fromEntries(e.map(([k, x]) => [k, shape(x, path ? `${path}.${k}` : k)]).sort(([a], [b]) => String(a).localeCompare(String(b))));
  }
  return typeof v;
}

const cell = (k: number) => { const r = createIndexed(4, 5); r.px.fill(k); return r; };
const PROV: Provenance = { assetId: 'sera', creator: 'u', sourceUrl: '', license: 'owned', aiUsed: true, promptRecord: '', editedBy: 'pixel-forge', sourceFile: 'a.png', exportFile: 'sera_sheet.png', rightsReviewed: false, creditText: '' };

describe('rowsheet frame_ms·phases(G2 U2)', () => {
  it('동작 메타의 frame_ms·phases·hold가 레이아웃에 실린다', async () => {
    const { rowSheetLayout } = await import('./rowsheet.js');
    const l = rowSheetLayout([{ name: 'right_side', dir: 'e' }], [{ name: 'cleave', fps: 8, frame_ms: [300, 300, 300, 120, 400, 400], phases: { telegraph: [0, 1, 2] }, hold: 2 }], [{ anim: 'cleave', dir: 'e', count: 6 }]);
    expect(l.animations.cleave).toMatchObject({ frames: 6, frame_ms: [300, 300, 300, 120, 400, 400], phases: { telegraph: [0, 1, 2] }, hold: 2 });
  });
});

describe('godot-rowsheet', () => {
  const s = rowSheet({
    cell: { w: 4, h: 5 }, rows: [{ name: 'front', dir: 's' }, { name: 'back', dir: 'n' }, { name: 'right_side', dir: 'e' }],
    anims: [{ name: 'idle', fps: 4 }, { name: 'run', fps: 9 }],
    frames: [
      { anim: 'idle', dir: 's', unique: [cell(1), cell(2)], order: [0, 1, 0, 1] },
      { anim: 'run', dir: 's', unique: [cell(3)], order: [0, 0, 0] },
      { anim: 'idle', dir: 'e', unique: [cell(4)], order: [0, 0, 0, 0] },
    ],
  });
  it('행 = 방향(프레임 없는 방향은 뺀다), 열 = 애니 연속, frameMap으로 원래 열 수 복원', () => {
    expect(s).toMatchObject({ columns: 7, rows: ['front', 'right_side'], animations: { idle: { start_column: 0, frames: 4, fps: 4 }, run: { start_column: 4, frames: 3, fps: 9 } } });
    expect([s.sheet.w, s.sheet.h]).toEqual([28, 10]);
    const at = (col: number, row: number) => s.sheet.px[(row * 5) * 28 + col * 4];
    expect([0, 1, 2, 3, 4, 6].map((c) => at(c, 0))).toEqual([1, 2, 1, 2, 3, 3]);
    expect([at(0, 1), at(4, 1)]).toEqual([4, 0]);
  });
  it('manifest 키 구조 = G1 3.2 형식(assetId·anchor 배열·display_scale·rows 맵·mirror·loop) + 이전 샘플 키 + provenance(11) + qa', () => {
    const m = godotRowManifest({
      assetId: 'hero_sera', version: 'v', source: 's', sheet: { ...s, w: s.sheet.w, h: s.sheet.h }, cell: { w: 4, h: 5 }, anchor: [2, 4], displayScale: 2, notes: ['n'], provenance: PROV,
      qa: { pass: true, warnings: [{ id: 'import.clipped', note: 'x' }] },
      directions: { down: { row: 'front', flip_h: false }, up: { row: 'back', flip_h: false }, right: { row: 'right_side', flip_h: false }, left: { row: 'right_side', flip_h: true } },
    });
    const { provenance, qa, assetId, display_scale, mirror, row_names, anchor_text, ...game } = m;
    // 이전 샘플과 다른 두 키: rows(행 이름 배열 → 방향→행 맵, 이름은 row_names), anchor(문장 → [x, y], 문장은 anchor_text)
    const sample = shape(SAMPLE) as Record<string, unknown>;
    const expected = { ...sample, rows: { down: 'number', right: 'number' }, anchor: ['[]', 'number'], animations: { '<name>': { fps: 'number', frames: 'number', loop: 'boolean', start_column: 'number' } } };
    expect(shape(game)).toEqual(Object.fromEntries(Object.entries(expected).sort(([x], [y]) => x.localeCompare(y))));
    expect([shape(row_names), shape(anchor_text)]).toEqual([sample.rows, sample.anchor]);
    expect({ assetId, display_scale, mirror }).toEqual({ assetId: 'hero_sera', display_scale: 2, mirror: { left: 'right' } });
    expect(Object.keys(provenance).sort()).toEqual(['aiUsed', 'assetId', 'creator', 'creditText', 'editedBy', 'exportFile', 'license', 'promptRecord', 'rightsReviewed', 'sourceFile', 'sourceUrl']);
    expect(m).toMatchObject({ quality: 'candidate', anchor: [2, 4], rows: { down: 0, right: 1 }, directions: { left: { row: 1, flip_h: true } }, qa: { warnings: [{ id: 'import.clipped' }] } });
    expect(m.directions).not.toHaveProperty('up');
    // run은 front 행에만 → rows_only
    expect(m.animations).toMatchObject({ idle: { loop: false }, run: { rows_only: ['down'] } });
    expect(m.animations.idle).not.toHaveProperty('rows_only');
  });
});
