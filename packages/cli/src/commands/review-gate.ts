import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { cacheKey } from '../cache.js';
import { writeFileEnsured } from '../io/files.js';
import { loadProject, type Project } from '../io/project.js';
import { projectDeps } from './deps.js';

/** pixel-reviewer 기준표(.claude/agents/pixel-reviewer.md): 12기준 × 2점, 합격선 18 */
export const REVIEW_MAX = 24;
export const REVIEW_PASS = 18;
export const REVIEW_FILE = 'review.json';

export interface ReviewRecord {
  id: string;
  score: number;
  max: number;
  passLine: number;
  pass: boolean;
  /** 채점한 입력(Spec·바이블·리그·애니·규칙) + 그때의 컨택트 시트 해시 — 입력이나 렌더 결과가 바뀌면 다시 검수해야 한다 */
  key: string;
  note?: string;
}

/** 입력 해시 + out/<id>/sheet.png 해시: 렌더러·QA 코드가 바뀌어 결과가 달라져도 옛 점수가 통과하지 않게 */
function keyOf(specPath: string, p: Project, cwd: string): string {
  const sheet = join(cwd, 'out', p.spec.id, 'sheet.png');
  const sheetHash = existsSync(sheet) ? createHash('sha256').update(readFileSync(sheet)).digest('hex') : 'no-sheet';
  return `${cacheKey(projectDeps(specPath, p, cwd))}:${sheetHash}`;
}

/** forge review-score <spec> --score <n> [--note ...]: pixel-reviewer가 채점 결과를 out/<id>/review.json에 남긴다 */
export function reviewScoreCommand(specPath: string, cwd: string, score: number, note?: string) {
  if (!Number.isInteger(score) || score < 0 || score > REVIEW_MAX) throw new ForgeError('cli.args', `--score는 0~${REVIEW_MAX} 정수여야 합니다: ${score}`);
  const p = loadProject(specPath, cwd);
  // QA 필수 통과한 build 결과만 채점한다(순서: build → QA → 검수 → apply)
  const qa = join(cwd, 'out', p.spec.id, 'qa.json');
  const passed = existsSync(qa) && (JSON.parse(readFileSync(qa, 'utf8')) as { pass?: unknown }).pass === true;
  if (!passed) throw new ForgeError('review.no-build', `QA 통과한 build 결과가 없습니다: out/${p.spec.id}/qa.json (먼저 forge build)`);
  const rec: ReviewRecord = { id: p.spec.id, score, max: REVIEW_MAX, passLine: REVIEW_PASS, pass: score >= REVIEW_PASS, key: keyOf(specPath, p, cwd), ...(note ? { note } : {}) };
  const out = join(cwd, 'out', p.spec.id, REVIEW_FILE);
  writeFileEnsured(out, Buffer.from(JSON.stringify(rec, null, 2) + '\n'));
  return { ok: true as const, cmd: 'review-score', id: p.spec.id, score, pass: rec.pass, out: relative(cwd, out) };
}

/** apply 전 검수 확인: 기록이 없거나, 지금 입력으로 채점한 것이 아니거나, 합격선 미만이면 이유 문자열 */
export function reviewProblem(specPath: string, p: Project, cwd: string): string | null {
  const path = join(cwd, 'out', p.spec.id, REVIEW_FILE);
  if (!existsSync(path)) return `검수 기록이 없습니다: out/${p.spec.id}/${REVIEW_FILE} (pixel-reviewer가 forge review-score로 남김)`;
  let rec: Partial<ReviewRecord>;
  try { rec = JSON.parse(readFileSync(path, 'utf8')) as Partial<ReviewRecord>; } catch { return `검수 기록을 읽을 수 없습니다: ${path}`; }
  if (rec.key !== keyOf(specPath, p, cwd)) return '검수 후 입력(Spec·바이블·리그·애니·규칙)이나 렌더 결과가 바뀌었습니다. 다시 검수하세요';
  if (typeof rec.score !== 'number' || rec.score < REVIEW_PASS) return `검수 점수 ${rec.score ?? '?'}/${REVIEW_MAX} < 합격선 ${REVIEW_PASS}`;
  return null;
}

/** build가 출력 폴더를 비울 때 검수 기록만 살려 둔다(키가 입력과 맞는지는 apply가 따진다) */
export function keepReview<T>(outDir: string, run: () => T): T {
  const path = join(outDir, REVIEW_FILE);
  const saved = existsSync(path) ? readFileSync(path) : null;
  try { return run(); } finally { if (saved) writeFileEnsured(path, saved); }
}

