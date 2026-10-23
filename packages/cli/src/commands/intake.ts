import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { decodePng } from '../io/png.js';
import { FILE_RULE, promptText, requestList, TURNAROUND, turnaroundFile, type PromptRequest } from '../prompts/assemble.js';
import { loadKit } from '../prompts/kit.js';
import { readState, writeState } from '../prompts/state.js';
import { intakeCutin } from './cutin.js';
import { intakePortrait } from './portrait.js';
import { archiveActor } from './archive.js';
import { promptSha } from './prompts.js';

/** 긴 변이 이보다 짧으면 경고(파일럿: 키 210px 원본은 테두리가 거칠었다 — P9-M 4) */
const MIN_LONG_SIDE = 1024;

/** intake 기록(.intake.json) — 출처·문구만. 사용자 경로·계정·키는 넣지 않는다(원본 파일 이름만) */
export interface IntakeMeta {
  origin: 'chatgpt-manual';
  model: string;
  createdAt: string;
  promptFile: string;
  promptSha256: string;
  references: string[];
  receivedFrom: 'user';
  sourceName: string;
  sha256: string;
  size: [number, number];
  warnings: string[];
}

/** 확장자가 아니라 파일 앞 바이트로 형식 판정 */
function formatOf(b: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** --as <actorId>/<action>_<dir>, 없으면 파일 이름 규칙 <actorId>__<action>_<dir>.png */
function target(file: string, as?: string): { actorId: string; key: string } {
  if (as) {
    const m = /^([a-z][a-z0-9_]*)\/([a-z][a-z0-9]*_[a-z]+)$/.exec(as);
    if (!m?.[1] || !m[2]) throw new ForgeError('intake.as', `--as 형식: <actorId>/<action>_<dir> (예: hero_sera/walk_side): ${as}`);
    return { actorId: m[1], key: m[2] };
  }
  const m = FILE_RULE.exec(basename(file));
  if (!m?.[1] || !m[2] || !m[3]) throw new ForgeError('intake.name', `파일 이름 규칙 <actorId>__<action>_<dir>.png와 다릅니다: ${basename(file)} — --as로 지정하세요`);
  return { actorId: m[1], key: `${m[2]}_${m[3]}` };
}

/** 원본 id: 받은 시각(파일 수정 시각 또는 --at) + 내용 해시 앞 8자 — 시계를 읽지 않고, 같은 파일은 같은 id */
const stampOf = (iso: string, sha: string) => `${iso.replace(/[-:]/g, '').replace(/\.\d+/, '')}_${sha.slice(0, 8)}`;

/**
 * forge intake <file> --as <actorId>/<action>_<dir> [--at <ISO 시각>]: 원본 등록 + 출처 기록.
 * → data/import/<actorId>/<key>/<stamp>.png + <stamp>.intake.json(gitignore). 이전 원본은 지우지 않는다(make는 최신본).
 * 입력은 작업 폴더 안만(resolveInside) — 채팅 첨부는 data/import/inbox/ 등 작업 폴더 안으로 먼저 복사한다.
 */
type IntakeOptions = { as?: string; at?: string; kind?: string; temp?: string; out?: string; archive?: string };
export function intakeCommand(file: string, cwd: string, o: IntakeOptions = {}) {
  const result = intakeOne(file, cwd, o);
  return o.archive ? { ...result, ...archiveActor(cwd, result.actor, o.archive) } : result;
}
function intakeOne(file: string, cwd: string, o: IntakeOptions) {
  if (o.kind === 'portrait') return intakePortrait(file, cwd, o);
  if (o.kind === 'reference') return intakeReference(file, cwd, o);
  if (o.kind === 'cutin') return intakeCutin(file, cwd, o);
  if (o.kind === 'sheet') return intakeSheet(file, cwd, o);
  if (o.kind !== undefined && o.kind !== 'action') throw new ForgeError('intake.kind', `--kind는 action | reference | cutin | sheet | portrait: ${o.kind}`);
  const src = resolveInside(cwd, file);
  const { actorId, key } = target(file, o.as);
  const kit = loadKit(actorId, cwd);
  const req: PromptRequest | undefined = requestList(kit).find((r) => r.key === key);
  if (!req) throw new ForgeError('intake.key', `${actorId}의 요청 목록에 없는 항목: ${key} (forge prompts ${actorId}의 CHECKLIST 참고)`);
  const { bytes, img, warnings, sha, createdAt, stamp } = readSource(src, file, o.at);
  const dir = join(cwd, 'data', 'import', actorId, key);
  const text = promptText(kit, req);
  const meta: IntakeMeta = {
    origin: 'chatgpt-manual', model: 'ChatGPT 이미지 생성(사용자 실행, 모델명 미확인)', createdAt, promptFile: req.promptFile, promptSha256: promptSha(text),
    references: req.references, receivedFrom: 'user', sourceName: basename(file), sha256: sha, size: [img.w, img.h], warnings,
  };
  writeFileEnsured(join(dir, `${stamp}.png`), bytes);
  writeFileSync(join(dir, `${stamp}.intake.json`), JSON.stringify(meta, null, 2) + '\n');
  const state = readState(cwd, actorId);
  // --temp: 받아서 make는 할 수 있지만 기준과 달라 다시 받아야 하는 원본(예: 망토 없는 걷기 — G2 DECISIONS)
  state.items[key] = { status: o.temp ? '재요청' : '등록', fails: state.items[key]?.fails ?? 0, latest: stamp, ...(o.temp ? { note: o.temp } : {}) };
  writeState(cwd, actorId, state);
  return { ok: true as const, cmd: 'intake', actor: actorId, key, stamp, size: [img.w, img.h], warnings, ...(o.temp ? { status: '재요청', note: o.temp } : {}), out: relative(cwd, join(dir, `${stamp}.png`)) };
}

/** 파일 읽기 + 형식(PNG만)·크기 경고·해시·받은 시각 */
function readSource(src: string, file: string, at?: string) {
  const bytes = readFileSync(src);
  const fmt = formatOf(bytes);
  if (fmt !== 'png') throw new ForgeError('intake.format', fmt ? `${fmt.toUpperCase()}는 아직 읽지 못합니다(디코더가 의존성 허용 목록 밖) — 원본 PNG를 전달하세요(JPEG 재저장본은 원본 등록 금지)` : `PNG/JPEG/WebP가 아닙니다: ${basename(file)}`);
  const img = decodePng(bytes);
  const warnings = Math.max(img.w, img.h) < MIN_LONG_SIDE ? [`긴 변 ${Math.max(img.w, img.h)}px < ${MIN_LONG_SIDE}px — 테두리가 거칠 수 있다(더 큰 해상도로 다시 저장 권장)`] : [];
  const sha = createHash('sha256').update(bytes).digest('hex');
  const createdAt = at ?? statSync(src).mtime.toISOString();
  return { bytes, img, warnings, sha, createdAt, stamp: stampOf(createdAt, sha) };
}

/**
 * --kind reference: 디자인 기준 이미지(참조 원본·턴어라운드) 등록 → data/import/<actorId>/references/<name>/.
 * 이름은 --as <actorId>/<name> 또는 파일 이름 <actorId>__<name>.png. 턴어라운드 파일이면 CHECKLIST 턴어라운드 항목을 '등록'으로.
 */
function intakeReference(file: string, cwd: string, o: { as?: string; at?: string }) {
  const src = resolveInside(cwd, file);
  const m = o.as ? /^([a-z][a-z0-9_]*)\/([a-z][a-z0-9_]*)$/.exec(o.as) : /^([a-z][a-z0-9_]*?)__([a-z][a-z0-9_]*)\.png$/.exec(basename(file));
  if (!m?.[1] || !m[2]) throw new ForgeError('intake.name', `참조 이미지 이름: <actorId>__<name>.png 또는 --as <actorId>/<name>: ${basename(file)}`);
  const actorId = m[1], name = m[2];
  const kit = loadKit(actorId, cwd);
  const isTurn = basename(file) === turnaroundFile(kit) || `${actorId}__${name}.png` === turnaroundFile(kit);
  const req = isTurn ? requestList(kit).find((r) => r.key === TURNAROUND) : undefined;
  const { bytes, img, warnings, sha, createdAt, stamp } = readSource(src, file, o.at);
  const dir = join(cwd, 'data', 'import', actorId, 'references', name);
  const meta: IntakeMeta = {
    origin: 'chatgpt-manual', model: 'ChatGPT 이미지 생성(사용자 실행, 모델명 미확인)', createdAt, promptFile: req?.promptFile ?? '', promptSha256: req ? promptSha(promptText(kit, req)) : '',
    references: req?.references ?? [], receivedFrom: 'user', sourceName: basename(file), sha256: sha, size: [img.w, img.h], warnings,
  };
  // 같은 이름의 이전 기준 이미지는 지우지 않고 superseded로 표시(G2 U1 — 망토 있는 기준 해제)
  const olds = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.intake.json') && !f.startsWith(stamp)) : [];
  for (const old of olds) {
    const m = JSON.parse(readFileSync(join(dir, old), 'utf8')) as IntakeMeta & { superseded?: boolean };
    if (!m.superseded) writeFileSync(join(dir, old), JSON.stringify({ ...m, superseded: true }, null, 2) + '\n');
  }
  writeFileEnsured(join(dir, `${stamp}.png`), bytes);
  writeFileSync(join(dir, `${stamp}.intake.json`), JSON.stringify(meta, null, 2) + '\n');
  if (isTurn) {
    const state = readState(cwd, actorId);
    state.items[TURNAROUND] = { status: '등록', fails: 0, latest: stamp };
    writeState(cwd, actorId, state);
  }
  return { ok: true as const, cmd: 'intake', kind: 'reference', actor: actorId, name, turnaround: isTurn, stamp, size: [img.w, img.h], warnings, out: relative(cwd, join(dir, `${stamp}.png`)) };
}

/** 등록된 원본: --pick 지정 또는 최신(stamp 사전순 마지막) */
export function pickIntake(cwd: string, actorId: string, key: string, pick?: string): { png: string; meta: IntakeMeta; stamp: string } {
  const dir = join(cwd, 'data', 'import', actorId, key);
  const stamps = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.intake.json')).map((f) => f.replace('.intake.json', '')).sort() : [];
  const stamp = pick ? stamps.find((s) => s === pick || s.startsWith(pick)) : stamps.at(-1);
  if (!stamp) throw new ForgeError('make.no-intake', `등록된 원본이 없습니다: ${actorId}/${key}${pick ? ` (--pick ${pick})` : ''} — forge intake 먼저`);
  const meta = JSON.parse(readFileSync(join(dir, `${stamp}.intake.json`), 'utf8')) as IntakeMeta;
  return { png: relative(cwd, join(dir, `${stamp}.png`)), meta, stamp };
}

/**
 * --kind sheet: 동작 시트(<actorId>__actions_<view>.png, 한 줄 = 한 동작 — G2 U3) 등록 → data/import/<actorId>/actions_<view>/.
 * 줄마다 동작 항목을 '등록'(spec = 시트 키)으로 표시한다. 줄 구성은 actors/<actorId>.json sheets가 정한다.
 */
function intakeSheet(file: string, cwd: string, o: { as?: string; at?: string }) {
  const src = resolveInside(cwd, file);
  const m = o.as ? /^([a-z][a-z0-9_]*)\/(actions_[a-z]+)$/.exec(o.as) : /^([a-z][a-z0-9_]*?)__(actions_[a-z]+)\.png$/.exec(basename(file));
  if (!m?.[1] || !m[2]) throw new ForgeError('intake.name', `동작 시트 이름: <actorId>__actions_<view>.png 또는 --as <actorId>/actions_<view>: ${basename(file)}`);
  const actorId = m[1], key = m[2];
  const kit = loadKit(actorId, cwd), sheet = kit.actor.sheets[key];
  if (!sheet) throw new ForgeError('intake.key', `${actorId}에 동작 시트 정의가 없습니다: ${key}`);
  const { bytes, img, warnings, sha, createdAt, stamp } = readSource(src, file, o.at);
  const dir = join(cwd, 'data', 'import', actorId, key);
  const meta: IntakeMeta = { origin: 'chatgpt-manual', model: 'ChatGPT 이미지 생성(사용자 실행, 모델명 미확인)', createdAt, promptFile: '', promptSha256: '', references: [...kit.actor.references, ...(kit.actor.sizeRefFile ? [kit.actor.sizeRefFile] : [])], receivedFrom: 'user', sourceName: basename(file), sha256: sha, size: [img.w, img.h], warnings };
  writeFileEnsured(join(dir, `${stamp}.png`), bytes);
  writeFileSync(join(dir, `${stamp}.intake.json`), JSON.stringify(meta, null, 2) + '\n');
  const state = readState(cwd, actorId);
  for (const r of sheet.rows) state.items[`${r.action}_${sheet.view}`] = { status: '등록', fails: 0, latest: stamp, spec: key };
  writeState(cwd, actorId, state);
  return { ok: true as const, cmd: 'intake', kind: 'sheet', actor: actorId, key, rows: sheet.rows.map((r) => `${r.action}×${r.frames}`), stamp, size: [img.w, img.h], warnings, out: relative(cwd, join(dir, `${stamp}.png`)) };
}
