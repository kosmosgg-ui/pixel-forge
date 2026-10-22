import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { cacheKey } from '../cache.js';
import { writeFileEnsured } from '../io/files.js';
import { loadProject, type Project } from '../io/project.js';
import { projectDeps } from './deps.js';
import { renderProject } from './qa.js';
import { parseSheetScale, studioPng } from './render.js';

/** pixel-reviewer 기준표(.claude/agents/pixel-reviewer.md): 12기준 × 2점, 합격선 18 */
export const REVIEW_MAX = 24;
export const REVIEW_PASS = 18;
export const REVIEW_FILE = 'review.json';
/** 검수 시트 = `forge render <spec> --sheet <배율>`의 out/<id>/studio.png */
export const STUDIO_FILE = 'studio.png';
export const REVIEW_CRITERIA = [
  '실루엣 판독', '역할색', '얼굴', '자세', '노이즈', '명암', '외곽선', '배경 가독성', '스케일 일관성', '군중 속 종류 구분', '무기·소품 식별', '역할 원형 판독',
] as const;

export interface ReviewRecord {
  id: string;
  score: number;
  max: number;
  passLine: number;
  pass: boolean;
  /** 채점한 입력(Spec·바이블·리그·애니·규칙) 해시 */
  key: string;
  /** 검수한 시트 PNG(out/<id>/studio.png)의 SHA-256과 배율 — apply가 지금 렌더로 같은 시트를 만들어 비교 */
  sheetHash: string;
  sheetScale: number;
  /** 기준별 관찰 1줄(관찰 먼저, 점수 나중) */
  observations: Record<string, string>;
  note?: string;
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const inputKey = (specPath: string, p: Project, cwd: string) => cacheKey(projectDeps(specPath, p, cwd));
const currentSheetHash = (p: Project, scale: number) => sha(studioPng(renderProject(p), p.bible.background, scale));

function parseObservations(raw: string | undefined): Record<string, string> {
  let obs: unknown;
  try { obs = JSON.parse(raw ?? ''); } catch { throw new ForgeError('cli.args', `--obs는 기준별 관찰 JSON 객체여야 합니다: {"${REVIEW_CRITERIA[0]}": "…", …}`); }
  if (typeof obs !== 'object' || obs === null || Array.isArray(obs)) throw new ForgeError('cli.args', '--obs는 JSON 객체여야 합니다');
  const rec = obs as Record<string, unknown>;
  const missing = REVIEW_CRITERIA.filter((c) => typeof rec[c] !== 'string' || !String(rec[c]).trim());
  if (missing.length) throw new ForgeError('review.observations', `관찰이 빠진 기준: ${missing.join(', ')}`, { missing });
  return Object.fromEntries(REVIEW_CRITERIA.map((c) => [c, String(rec[c]).trim()]));
}

/**
 * forge review-score <spec> --score <n> --obs '<기준별 관찰 JSON>' [--note ...] [--sheet 배율(기본 4)]: pixel-reviewer가 검수 결과를 out/<id>/review.json에 남긴다.
 * QA 통과한 build와, 지금 렌더로 만든 것과 같은 검수 시트(studio.png)가 있어야 한다.
 */
export function reviewScoreCommand(specPath: string, cwd: string, score: number, obsJson?: string, note?: string, scale = 4) {
  parseSheetScale(scale);
  if (!Number.isInteger(score) || score < 0 || score > REVIEW_MAX) throw new ForgeError('cli.args', `--score는 0~${REVIEW_MAX} 정수여야 합니다: ${score}`);
  const observations = parseObservations(obsJson);
  const p = loadProject(specPath, cwd);
  const qa = join(cwd, 'out', p.spec.id, 'qa.json');
  const passed = existsSync(qa) && (JSON.parse(readFileSync(qa, 'utf8')) as { pass?: unknown }).pass === true;
  if (!passed) throw new ForgeError('review.no-build', `QA 통과한 build 결과가 없습니다: out/${p.spec.id}/qa.json (먼저 forge build)`);
  const studio = join(cwd, 'out', p.spec.id, STUDIO_FILE);
  if (!existsSync(studio)) throw new ForgeError('review.no-sheet', `검수 시트가 없습니다: out/${p.spec.id}/${STUDIO_FILE} (forge render <spec> --sheet 4)`);
  const sheetHash = sha(readFileSync(studio));
  if (sheetHash !== currentSheetHash(p, scale)) throw new ForgeError('review.stale-sheet', `검수 시트가 지금 렌더와 다릅니다: 다시 forge render ${specPath} --sheet ${scale} 후 검수`);
  const rec: ReviewRecord = {
    id: p.spec.id, score, max: REVIEW_MAX, passLine: REVIEW_PASS, pass: score >= REVIEW_PASS, key: inputKey(specPath, p, cwd),
    sheetHash, sheetScale: scale, observations, ...(note ? { note } : {}),
  };
  const out = join(cwd, 'out', p.spec.id, REVIEW_FILE);
  writeFileEnsured(out, Buffer.from(JSON.stringify(rec, null, 2) + '\n'));
  return { ok: true as const, cmd: 'review-score', id: p.spec.id, score, pass: rec.pass, sheetHash: sheetHash.slice(0, 12), out: relative(cwd, out) };
}

/** apply 전 검수 확인: 기록 없음·입력 변경·지금 렌더로 만든 시트 해시 ≠ sheetHash·합격선 미만이면 이유 문자열 */
export function reviewProblem(specPath: string, p: Project, cwd: string): string | null {
  const path = join(cwd, 'out', p.spec.id, REVIEW_FILE);
  if (!existsSync(path)) return `검수 기록이 없습니다: out/${p.spec.id}/${REVIEW_FILE} (pixel-reviewer가 forge review-score로 남김)`;
  let rec: Partial<ReviewRecord>;
  try { rec = JSON.parse(readFileSync(path, 'utf8')) as Partial<ReviewRecord>; } catch { return `검수 기록을 읽을 수 없습니다: ${path}`; }
  if (rec.key !== inputKey(specPath, p, cwd)) return '검수 후 입력(Spec·바이블·리그·애니·규칙)이 바뀌었습니다. 다시 검수하세요';
  if (typeof rec.sheetHash !== 'string' || typeof rec.sheetScale !== 'number' || !Number.isInteger(rec.sheetScale) || rec.sheetScale < 1 || rec.sheetScale > 16) return '검수 기록에 sheetHash·sheetScale이 없거나 잘못됐습니다. 다시 검수하세요';
  if (rec.sheetHash !== currentSheetHash(p, rec.sheetScale)) return '지금 렌더 결과가 검수한 시트와 다릅니다(sheetHash 불일치). 다시 검수하세요';
  if (typeof rec.score !== 'number' || rec.score < REVIEW_PASS) return `검수 점수 ${rec.score ?? '?'}/${REVIEW_MAX} < 합격선 ${REVIEW_PASS}`;
  return null;
}

/** build가 출력 폴더를 비울 때 검수 기록·검수 시트를 살려 둔다(맞는지는 apply가 따진다) */
export function keepReview<T>(outDir: string, run: () => T): T {
  const saved = [REVIEW_FILE, STUDIO_FILE].map((f) => [f, existsSync(join(outDir, f)) ? readFileSync(join(outDir, f)) : null] as const);
  try { return run(); } finally { for (const [f, b] of saved) if (b) writeFileEnsured(join(outDir, f), b); }
}
