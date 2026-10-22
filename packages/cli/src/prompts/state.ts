import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { writeFileEnsured } from '../io/files.js';

/** 요청 상태(CHECKLIST 상태 열): 대기 → 등록(intake) → 합격 | 재요청(make) */
export const STATUS = ['대기', '등록', '합격', '재요청'] as const;
const stateSchema = z.object({
  items: z.record(z.string(), z.object({ status: z.enum(STATUS), fails: z.number().int().min(0).default(0), latest: z.string().optional() })).default({}),
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
