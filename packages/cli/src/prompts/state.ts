import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { writeFileEnsured } from '../io/files.js';

/** 요청 상태(CHECKLIST 상태 열): 대기 → 등록(intake) → 합격 | 재요청(make) */
export const STATUS = ['대기', '등록', '합격', '재요청'] as const;
const stateSchema = z.object({
  items: z.record(z.string(), z.object({ status: z.enum(STATUS), fails: z.number().int().min(0).default(0), latest: z.string().optional(), note: z.string().optional(), made: z.boolean().optional(), spec: z.string().optional() })).default({}),
});
export type ActorState = z.infer<typeof stateSchema>;

/** data/import/<actorId>/state.json(gitignore — 생성 원본과 같은 곳) */
export const stateFile = (cwd: string, actorId: string) => join(cwd, 'data', 'import', actorId, 'state.json');

export function readState(cwd: string, actorId: string): ActorState {
  const f = stateFile(cwd, actorId);
  return existsSync(f) ? stateSchema.parse(JSON.parse(readFileSync(f, 'utf8'))) : { items: {} };
}

export function writeState(cwd: string, actorId: string, s: ActorState): void {
  const f = stateFile(cwd, actorId);
  if (!existsSync(f)) writeFileEnsured(f, Buffer.from('{}'));
  writeFileSync(f, JSON.stringify(s, null, 2) + '\n');
}

/** 다음에 사용자에게 낼 요청 순서: 재요청 먼저, 그다음 대기(목록 순서). 등록·합격은 낼 것이 없다 */
export function nextRequests<T extends { key: string }>(list: readonly T[], s: ActorState, n = 3): T[] {
  const st = (k: string) => s.items[k]?.status ?? '대기';
  return [...list.filter((r) => st(r.key) === '재요청'), ...list.filter((r) => st(r.key) === '대기')].slice(0, n);
}

/** 후보 출력 실패 시 원래 상태 바이트를 복원한다. 합격/등록 상태를 앞서 확정하지 않는다. */
export function withStateUpdate<T>(cwd: string, actorId: string, next: ActorState, run: () => T): T {
  const file = stateFile(cwd, actorId), before = existsSync(file) ? readFileSync(file) : undefined;
  try { writeState(cwd, actorId, next); return run(); } catch (error) {
    if (before) writeFileSync(file, before); else rmSync(file, { force: true });
    throw error;
  }
}
