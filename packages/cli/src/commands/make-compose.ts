import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError, toRGBA } from '@pixel-forge/core';
import { godotRowManifest, rowSheetLayout, type RowAnimMeta } from '@pixel-forge/export';
import { importChecks, measureStride } from '@pixel-forge/import';
import { encodePng } from '../io/png.js';
import { writeFileEnsured } from '../io/files.js';
import { pxlBin, pxlStudy } from '../io/pxl.js';
import { parseStudy, studyWarnings, type StudyNumbers } from './study.js';
import type { Kit } from '../prompts/kit.js';
import { readState } from '../prompts/state.js';
import { qaContextOf, runImport, type Imported } from './import.js';
import { displayScaleOf, loadTarget, writeRowExport } from './import-target.js';
import { pickIntake } from './intake.js';
import { scaleQa } from './make-scale.js';

/** make Spec 경로(out/make/<actorId>/<key>.spec.json) */
export const makeSpecPath = (actorId: string, key: string) => join('out', 'make', actorId, `${key}.spec.json`);

/** 사용자 생성물 라이선스 문구(P9-M 4 — 사람이 확인) */
const LICENSE = 'OpenAI 이용약관에 따른 사용자 생성물(사용자 확인 필요)';

interface Part { key: string; im: Imported; anim: string; dir: string; order: number[] }

/**
 * 합격한 항목 전부를 다시 import(결정론 — 같은 원본·Spec → 같은 프레임). 동작 시트(G2 U3)는 여러 동작이 Spec 하나를 공유하므로
 * Spec(state spec, 없으면 항목 키)마다 한 번만 import한다.
 */
function passedParts(kit: Kit, cwd: string): Part[] {
  const st = readState(cwd, kit.actor.id);
  const specs = [...new Set(Object.entries(st.items).filter(([, v]) => v.status === '합격' || v.made === true).map(([key, v]) => v.spec ?? key))]
    .filter((k) => existsSync(join(cwd, makeSpecPath(kit.actor.id, k)))).sort();
  return specs.flatMap((key) => {
    const im = runImport(makeSpecPath(kit.actor.id, key), cwd);
    return Object.entries(im.result.frameMap).map(([k, order]) => {
      const f = im.result.frames.find((g) => `${g.anim}_${g.dir}` === k);
      return { key, im, anim: f?.anim ?? '', dir: f?.dir ?? '', order };
    });
  });
}

/** 동작 순서 = actor.produce 처음 나온 순서, 메타 = 동작 데이터. walk stride_px는 변환 결과 실측값이 있으면 그것(P10 0절) */
const animMetas = (kit: Kit, measured: Readonly<Record<string, number>>): RowAnimMeta[] => [...new Set(kit.actor.produce.map((p) => p.action))].flatMap((id) => {
  const a = kit.actions[id];
  const stride = measured[id] ?? a?.stride_px;
  return a ? [{ name: id, fps: a.fps, loop: a.loop, ...(stride !== undefined ? { stride_px: stride } : {}), ...(a.ms ? { frame_ms: a.ms } : {}), ...(a.phases ? { phases: a.phases } : {}), ...(a.hold !== undefined ? { hold: a.hold } : {}) }] : [];
});

/** 걷기 접지 프레임(키트 포즈 1·4번 = 원래 순서 0·3)의 앞뒤 발 간격 평균(옆 방향 걷기만) */
function measuredStrides(parts: readonly Part[]): Record<string, number> {
  const walk = parts.find((p) => p.anim === 'walk' && p.dir === 'e');
  if (!walk) return {};
  const frames = walk.im.result.frames.filter((f) => f.anim === 'walk' && f.dir === 'e').sort((a, b) => a.index - b.index);
  const contact = [0, 3].flatMap((i) => { const u = walk.order[i]; const f = u === undefined ? undefined : frames[u]; return f ? [f.frame] : []; });
  const v = measureStride(contact);
  return v > 0 ? { walk: v } : {};
}

/** pxl study 수치(P10 2.4, qa.study) — pxl이 없으면 null(정보 항목이라 make를 막지 않는다) */
function studyOf(cwd: string, actorId: string, png: Buffer): (StudyNumbers & { warnings: string[] }) | null {
  let bin: string;
  try { bin = pxlBin(process.env, process.version); } catch { return null; }
  const file = join(cwd, 'out', 'make', actorId, 'study_sheet.png');
  writeFileEnsured(file, png);
  const s = parseStudy(pxlStudy(bin, file));
  return { ...s, warnings: studyWarnings(s) };
}

/** 여러 원본의 셀 → 시트 셀: 가장 넓고 높은 것, 앵커는 가로 가운데·바닥 거리 유지(가장 큰 셀 기준) */
function unifiedCell(cells: readonly { w: number; h: number; anchor: readonly [number, number] }[]): { w: number; h: number; anchor: [number, number] } {
  const big = cells.reduce((a, c) => (c.w * c.h > a.w * a.h ? c : a));
  const w = Math.max(...cells.map((c) => c.w)), h = Math.max(...cells.map((c) => c.h)), below = big.h - 1 - big.anchor[1];
  return { w, h, anchor: [Math.floor(w / 2), h - 1 - below] };
}

/** 셀 하나를 RGBA 시트에 붙인다(원본마다 팔레트가 달라 인덱스가 아니라 RGBA로 합친다) */
function blit(sheet: Uint8Array, sw: number, rgba: Uint8Array, w: number, h: number, ox: number, oy: number): void {
  for (let y = 0; y < h; y++) sheet.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), ((oy + y) * sw + ox) * 4);
}

/**
 * 캐릭터 후보 시트: 합격 항목들을 godot-rowsheet 배치로 합쳐 출력(@<게임>/<dir>/<actorId>/). 동작마다 원본이 달라 팔레트도 따로다.
 */
export function composeCandidates(kit: Kit, cwd: string, outArg?: string) {
  const parts = passedParts(kit, cwd);
  const first = parts[0];
  if (!first) throw new ForgeError('make.empty', `합격한 항목이 없습니다: ${kit.actor.id}`);
  const t = loadTarget(first.im.bible.id, cwd), cell = unifiedCell(parts.map((p) => p.im.cell));
  const layout = rowSheetLayout(t.rows, animMetas(kit, measuredStrides(parts)), parts.map((p) => ({ anim: p.anim, dir: p.dir, count: p.order.length })));
  const W = layout.columns * cell.w, H = layout.rows.length * cell.h, rgba = new Uint8Array(W * H * 4);
  for (const p of parts) {
    const ry = layout.rows.findIndex((r) => r.dir === p.dir), start = layout.animations[p.anim]?.start_column ?? 0;
    const frames = p.im.result.frames.filter((f) => f.anim === p.anim && f.dir === p.dir).sort((a, b) => a.index - b.index);
    p.order.forEach((u, i) => {
      const f = frames[u]?.frame;
      // 원본마다 셀이 다르면(동작 시트 cellGrow) 발 앵커를 맞춰 붙인다
      const dx = cell.anchor[0] - p.im.cell.anchor[0], dy = cell.anchor[1] - p.im.cell.anchor[1];
      if (f) blit(rgba, W, toRGBA(f, p.im.palette), f.w, f.h, (start + i) * cell.w + dx, ry * cell.h + dy);
    });
  }
  const keys = [...new Set(parts.map((p) => p.key))];
  const intakes = keys.map((k) => pickIntake(cwd, kit.actor.id, k, readState(cwd, kit.actor.id).items[k]?.latest));
  const manifest = godotRowManifest({
    assetId: kit.actor.id, version: t.version, source: `pixel-forge make: chatgpt-manual (${keys.join(', ')})`,
    sheet: { w: W, h: H, columns: layout.columns, rows: layout.rows.map((r) => r.name), animations: layout.animations },
    cell, directions: t.directions, anchor: cell.anchor, displayScale: displayScaleOf(first.im.bible),
    notes: [...t.notes, '동작마다 원본이 달라 팔레트가 따로다(같은 캐릭터 색 통일은 후속)'],
    provenance: {
      assetId: kit.actor.id, creator: 'user via ChatGPT', sourceUrl: '', license: LICENSE, aiUsed: true,
      promptRecord: intakes.map((x) => x.meta.promptFile).join(', '), editedBy: t.provenance.editedBy,
      sourceFile: intakes.map((x) => x.png).join(', '), exportFile: `${kit.actor.id}_sheet.png`, rightsReviewed: false, creditText: t.provenance.creditText,
    },
    qa: { pass: true, warnings: [...new Map(parts.map((p) => [p.key, p.im])).entries()].flatMap(([k, im]) => importChecks(im.result, qaContextOf(im)).filter((c) => !c.pass).map((c) => ({ id: c.id, note: `${k}: ${c.note ?? ''}`.trim() }))) },
  });
  // G2 U1: 크기 보정 기록 + 동작 사이 머리 크기 일치
  const sq = scaleQa(cwd, kit.actor.id, parts);
  Object.assign(manifest.qa, { scaleAnchor: sq.scaleAnchor, heads: sq.heads });
  manifest.qa.warnings.push(...sq.warnings);
  const png = encodePng({ w: W, h: H, rgba });
  const study = studyOf(cwd, kit.actor.id, png);
  if (study) Object.assign(manifest.qa, { study });
  return { ...writeRowExport(cwd, t, kit.actor.id, png, manifest, join(cwd, 'out', 'make', kit.actor.id, 'godot-rowsheet'), outArg), columns: layout.columns, rows: layout.rows.map((r) => r.name), sheetSize: [W, H], parts: keys };
}
