import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { boxDownscale, removeBackgroundInPlace } from '@pixel-forge/import';
import { promptCutinSchema } from '@pixel-forge/spec';
import { readJson, writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { decodePng, encodePng } from '../io/png.js';
import { resolveOut } from '../io/targets.js';
import { fill } from '../prompts/assemble.js';
import { loadKit } from '../prompts/kit.js';
import { loadTarget } from './import-target.js';
import { promptSha } from './prompts.js';

/** 컷인 최대 가로(게임 뷰포트 1280) */
const MAX_W = 1280;
const LICENSE = 'OpenAI 이용약관에 따른 사용자 생성물(사용자 확인 필요)';

/** 컷인 요청 문구(out/prompts/<actorId>/cutin.txt) */
export function cutinPrompt(actorId: string, cwd: string): { text: string; file: string } {
  const kit = loadKit(actorId, cwd);
  const c = readJson(join(cwd, 'data', 'projects', kit.project, 'prompts', 'actions', 'cutin.json'), promptCutinSchema);
  const text = fill(c.text, { character: kit.actor.description, style: kit.base.style.join(', '), rules: [...kit.base.rules, ...kit.actor.mustKeep].join('; '), background: kit.actor.altBackground ? kit.base.background.alt : kit.base.background.default });
  const file = `out/prompts/${actorId}/cutin.txt`;
  writeFileEnsured(join(cwd, file), Buffer.from(text));
  return { text, file };
}

/**
 * forge intake <file> --kind cutin [--as <actorId>/cutin] [--out @이름]: 필살기 컷인 — 도트 변환하지 않고 배경(초록) 제거 + 가로 1280 이하 선형(면적) 축소만.
 * 원본 → data/import/<actorId>/cutin/(gitignore), 결과 → @게임 candidates/cutin_<actorId>/cutin.png + 매니페스트(kind cutin, aiUsed true).
 */
export function intakeCutin(file: string, cwd: string, o: { as?: string; at?: string; out?: string } = {}) {
  const src = resolveInside(cwd, file);
  const m = o.as ? /^([a-z][a-z0-9_]*)\/cutin$/.exec(o.as) : /^([a-z][a-z0-9_]*?)__cutin\.png$/.exec(basename(file));
  const actorId = m?.[1];
  if (!actorId) throw new ForgeError('intake.name', `컷인 이름: <actorId>__cutin.png 또는 --as <actorId>/cutin: ${basename(file)}`);
  const bytes = readFileSync(src);
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) throw new ForgeError('intake.format', `PNG만 읽습니다: ${basename(file)}`);
  const img = decodePng(bytes);
  removeBackgroundInPlace(img);
  const out = img.w > MAX_W ? boxDownscale(img, MAX_W / img.w, 1) : img;
  const sha = createHash('sha256').update(bytes).digest('hex'), createdAt = o.at ?? statSync(src).mtime.toISOString();
  const stamp = `${createdAt.replace(/[-:]/g, '').replace(/\.\d+/, '')}_${sha.slice(0, 8)}`;
  const prompt = cutinPrompt(actorId, cwd);
  const dir = join(cwd, 'data', 'import', actorId, 'cutin');
  writeFileEnsured(join(dir, `${stamp}.png`), bytes);
  writeFileSync(join(dir, `${stamp}.intake.json`), JSON.stringify({ origin: 'chatgpt-manual', model: 'ChatGPT 이미지 생성(사용자 실행, 모델명 미확인)', createdAt, promptFile: prompt.file, promptSha256: promptSha(prompt.text), references: [], receivedFrom: 'user', sourceName: basename(file), sha256: sha, size: [img.w, img.h], warnings: [] }, null, 2) + '\n');
  const kit = loadKit(actorId, cwd), t = loadTarget(kit.actor.bible, cwd), assetId = `cutin_${actorId}`;
  const manifest = {
    assetId, kind: 'cutin', version: t.version, quality: 'candidate', size: [out.w, out.h], source: `chatgpt-manual 일러스트(도트 변환 안 함): ${basename(file)}`,
    notes: ['배경 제거 + 가로 1280 이하 축소만(P10 3절)'],
    provenance: { assetId, creator: 'user via ChatGPT', sourceUrl: '', license: LICENSE, aiUsed: true, promptRecord: prompt.file, editedBy: t.provenance.editedBy, sourceFile: relative(cwd, join(dir, `${stamp}.png`)), exportFile: 'cutin.png', rightsReviewed: false, creditText: '' },
  };
  const png = encodePng(out), json = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const outArg = o.out ?? t.out, local = join(cwd, 'out', 'cutin', assetId), dest = resolveInside(resolveOut(cwd, outArg), join(t.dir, assetId));
  for (const d of [local, dest]) { writeFileEnsured(join(d, 'cutin.png'), png); writeFileEnsured(join(d, `${assetId}_manifest.json`), json); }
  return { ok: true as const, cmd: 'intake', kind: 'cutin', actor: actorId, size: [out.w, out.h], stamp, dest: outArg.startsWith('@') ? `${outArg}/${join(t.dir, assetId)}` : relative(cwd, dest) };
}
