import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { probeImage } from '@pixel-forge/import';
import { writeFileEnsured } from '../io/files.js';
import { decodePng } from '../io/png.js';
import { loadKit, type Kit } from '../prompts/kit.js';
import { readState, writeState } from '../prompts/state.js';
import { importCommand } from './import.js';
import { pickIntake } from './intake.js';
import { composeCandidates, makeSpecPath } from './make-compose.js';
import { promptsCommand } from './prompts.js';

/** 시트 키: actions_<view> */
export const sheetKey = (view: string) => `actions_${view}`;

function sheetOf(kit: Kit, key: string) {
  const sh = kit.actor.sheets[key];
  if (!sh) throw new ForgeError('make.sheet', `${kit.actor.id}에 동작 시트 정의가 없습니다: ${key} (actors/${kit.actor.id}.json sheets)`);
  return sh;
}

/** 시트 import Spec: 줄 i = 동작 i(프레임 수 고정), 배율은 시트 하나에 하나(anchor) */
function writeSheetSpec(kit: Kit, key: string, png: string, meta: { createdAt: string }, cwd: string): string {
  const sh = sheetOf(kit, key), dir = kit.base.importDirs[sh.view] ?? sh.view;
  const spec = {
    id: `${kit.actor.id}-${key.replace('_', '-')}`, kind: 'character', bible: kit.actor.bible, sizeClass: kit.actor.sizeClass, mode: 'import',
    source: { path: png, origin: 'chatgpt-manual', createdAt: meta.createdAt },
    layout: { rows: sh.rows.map((r, i) => ({ anim: r.action, dir, row: i, frames: [...Array(r.frames).keys()], fps: kit.actions[r.action]?.fps ?? 8 })) },
    loop: sh.rows.filter((r) => kit.actions[r.action]?.loop).map((r) => r.action),
    cleanup: true, scaleAnchor: sh.anchor, cellGrow: true,
    ...(kit.actor.paletteMax !== undefined ? { palette: { max: kit.actor.paletteMax } } : {}),
    ...(kit.actor.dropHue ? { dropHue: kit.actor.dropHue } : {}), ...(kit.actor.redToMetal ? { redToMetal: true } : {}),
  };
  const p = makeSpecPath(kit.actor.id, key);
  writeFileEnsured(join(cwd, p), Buffer.from(JSON.stringify(spec, null, 2) + '\n'));
  return p;
}

/**
 * forge make <actorId> --sheet <view>: 동작 시트(한 줄 = 한 동작) 최신 원본 → 줄·프레임 수 확인 → import·QA → 후보 시트.
 * 줄 수나 줄별 프레임 수가 다르면 만들지 않고 실측값을 돌려준다(사람이 줄 구성을 정한다).
 */
export function makeSheetCommand(actorId: string, cwd: string, o: { view: string; pick?: string; out?: string }) {
  const kit = loadKit(actorId, cwd), key = sheetKey(o.view), sh = sheetOf(kit, key);
  const picked = pickIntake(cwd, actorId, key, o.pick);
  const probe = probeImage(decodePng(readFileSync(join(cwd, picked.png))));
  const want = sh.rows.map((r) => r.frames);
  if (probe.rows !== want.length || probe.perRow.some((n, i) => n !== want[i])) {
    return { ok: true as const, cmd: 'make', actor: actorId, key, pass: false, reason: 'rows', expected: want, found: probe.perRow };
  }
  const imported = importCommand(writeSheetSpec(kit, key, picked.png, picked.meta, cwd), cwd);
  const state = readState(cwd, actorId);
  for (const r of sh.rows) state.items[`${r.action}_${sh.view}`] = { status: '합격', fails: 0, latest: picked.stamp, spec: key };
  writeState(cwd, actorId, state);
  const exported = composeCandidates(kit, cwd, o.out);
  return { ok: true as const, cmd: 'make', actor: actorId, key, pass: true, actions: sh.rows.map((r) => `${r.action}×${r.frames}`), warnings: imported.warnings, exported, next: promptsCommand(actorId, cwd).next };
}
