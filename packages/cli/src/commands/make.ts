import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { cornerBackground, probeImage } from '@pixel-forge/import';
import type { PromptView } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';
import { decodePng } from '../io/png.js';
import { fixText, promptText, requestList } from '../prompts/assemble.js';
import { retryAdvice, selectFixes, type MakeFindings } from '../prompts/fix-select.js';
import { loadKit, type Kit } from '../prompts/kit.js';
import { readState, writeState } from '../prompts/state.js';
import { importCommand } from './import.js';
import { pickIntake } from './intake.js';
import { composeCandidates, makeSpecPath } from './make-compose.js';
import { promptsCommand } from './prompts.js';

export interface MakeArgs { action: string; dir: string; pick?: string; judge?: string; out?: string }

/** 원본 배경이 지울 수 있는 단색인가: 네 모서리 최빈색이 초록·마젠타·흰색 근처(P8fix 4) */
function backgroundOk(png: Buffer): boolean {
  const img = decodePng(png);
  const bg = cornerBackground(img);
  if (!bg) return (img.rgba[3] ?? 255) < 255;
  const [r, g, b] = bg;
  return (g > 200 && r < 80 && b < 80) || (r > 200 && b > 200 && g < 80) || Math.min(r, g, b) >= 225;
}

/** make용 import Spec(메모리 → out/make/<actorId>/<key>.spec.json, CLI 진입 검증과 같은 스키마로 읽힌다) */
function writeSpec(kit: Kit, key: string, action: string, view: PromptView, png: string, meta: { createdAt: string; promptFile: string }, cwd: string): string {
  const a = kit.actions[action];
  if (!a) throw new ForgeError('make.action', `동작 데이터가 없습니다: ${action}`);
  const spec = {
    id: `${kit.actor.id}-${key.replace('_', '-')}`, kind: 'character', bible: kit.actor.bible, sizeClass: kit.actor.sizeClass, mode: 'import',
    source: { path: png, origin: 'chatgpt-manual', createdAt: meta.createdAt, prompt: meta.promptFile },
    layout: { rows: [{ anim: action, dir: kit.base.importDirs[view] ?? view, frames: [...Array(a.frames).keys()], fps: a.fps }] },
    loop: a.loop ? [action] : [],
  };
  const p = makeSpecPath(kit.actor.id, key);
  writeFileEnsured(join(cwd, p), Buffer.from(JSON.stringify(spec, null, 2) + '\n'));
  return p;
}

/**
 * forge make <actorId> --action <a> --dir <side|front|back>: 최신(또는 --pick) 원본 → import·QA → 합격이면 후보 시트(@게임 candidates),
 * 불합격이면 고치기 문구를 골라 out/prompts/<actorId>/fix_<key>.txt + 안내(API 호출 없음 — 사용자가 ChatGPT에 보낸다).
 */
export function makeCommand(actorId: string, cwd: string, o: MakeArgs) {
  const kit = loadKit(actorId, cwd);
  const key = `${o.action}_${o.dir}`;
  const req = requestList(kit).find((r) => r.key === key && r.view !== 'all');
  const a = kit.actions[o.action];
  if (!req || !a || req.view === 'all') throw new ForgeError('make.key', `${actorId}의 요청 목록에 없는 동작·방향: ${key}`);
  const picked = pickIntake(cwd, actorId, key, o.pick);
  const bytes = readFileSync(join(cwd, picked.png));
  const probe = probeImage(decodePng(bytes));
  const findings: MakeFindings = { sprites: probe.sprites, frames: a.frames, failed: [], backgroundOk: backgroundOk(bytes), view: req.view, ...(o.judge ? { judge: o.judge } : {}) };
  let imported: ReturnType<typeof importCommand> | undefined;
  if (findings.sprites === a.frames && findings.backgroundOk) {
    try {
      imported = importCommand(writeSpec(kit, key, o.action, req.view, picked.png, picked.meta, cwd), cwd);
      const qa = JSON.parse(readFileSync(join(cwd, imported.out, 'qa.json'), 'utf8')) as { checks: { id: string; pass: boolean; note?: string }[] };
      findings.failed = qa.checks.filter((c) => !c.pass && c.id !== 'import.palette-delta');
    } catch (e) {
      if (!(e instanceof ForgeError) || !e.code.startsWith('import.')) throw e;
      findings.failed = [{ id: e.code, note: e.message }];
    }
  }
  return finishMake(kit, cwd, key, req.file, picked.stamp, findings, o, req);
}

function finishMake(kit: Kit, cwd: string, key: string, file: string, stamp: string, f: MakeFindings, o: MakeArgs, req: Parameters<typeof promptText>[1]) {
  const choice = selectFixes(f);
  const state = readState(cwd, kit.actor.id);
  const prev = state.items[key];
  const pass = !choice.frameCount && choice.ids.length === 0;
  state.items[key] = { status: pass ? '합격' : '재요청', fails: pass ? 0 : (prev?.fails ?? 0) + 1, latest: stamp };
  writeState(cwd, kit.actor.id, state);
  if (pass) {
    const exported = composeCandidates(kit, cwd, o.out);
    const p = promptsCommand(kit.actor.id, cwd);
    return { ok: true as const, cmd: 'make', actor: kit.actor.id, key, pass: true, exported, next: p.next };
  }
  const fails = state.items[key]?.fails ?? 1;
  const text = (choice.frameCount ? promptText(kit, req) + '\n' : '') + fixText(kit, choice.ids, { frames: f.frames, frameCount: choice.frameCount, ...(choice.frame !== undefined ? { frame: choice.frame } : {}) });
  const fixFile = join(cwd, 'out', 'prompts', kit.actor.id, `fix_${key}.txt`);
  writeFileEnsured(fixFile, Buffer.from(text));
  promptsCommand(kit.actor.id, cwd);
  return { ok: true as const, cmd: 'make', actor: kit.actor.id, key, pass: false, fails, fixes: choice.ids, frameCount: choice.frameCount, advice: retryAdvice(fails, file), fix: relative(cwd, fixFile) };
}
