import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';

const pair = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);
const clip = z.object({
  start_column: z.number().int().nonnegative(), frames: z.number().int().positive(), fps: z.number().positive(),
  loop: z.boolean().default(false), rows_only: z.array(z.string()).default([]),
  stride_px: z.number().positive().optional(), frame_ms: z.array(z.number().positive()).optional(),
  phases: z.record(z.string(), z.array(z.number().int().nonnegative())).optional(), hold: z.number().int().nonnegative().optional(),
}).passthrough();
export const candidateSchema = z.object({
  assetId: z.string(), quality: z.literal('candidate'), frame_size: z.tuple([z.number().int().positive(), z.number().int().positive()]), sheet_size: z.tuple([z.number().int().positive(), z.number().int().positive()]), anchor: pair,
  display_scale: z.number().int().positive(), mirror: z.record(z.string(), z.string()).default({}), rows: z.record(z.string(), z.number().int().nonnegative()),
  animations: z.record(z.string(), clip), provenance: z.record(z.string(), z.unknown()).default({}),
  qa: z.object({ pass: z.boolean(), warnings: z.array(z.object({ id: z.string(), note: z.string().optional() }).passthrough()) }).passthrough(),
}).passthrough().superRefine((m, ctx) => {
  const [w, h] = m.frame_size, [sw, sh] = m.sheet_size;
  const bad = sw % w !== 0 || sh % h !== 0 || m.anchor[0] >= w || m.anchor[1] >= h
    || Object.values(m.rows).some((r) => (r + 1) * h > sh)
    || Object.values(m.animations).some((a) => (a.start_column + a.frames) * w > sw
      || (a.frame_ms !== undefined && a.frame_ms.length !== a.frames)
      || (a.hold !== undefined && a.hold >= a.frames)
      || Object.values(a.phases ?? {}).some((indices) => indices.some((i) => i >= a.frames)));
  if (bad) ctx.addIssue({ code: 'custom', message: '시트/프레임/시간 메타 범위 불일치' });
});
export type Candidate = z.infer<typeof candidateSchema>;
const aliases: Record<string, string> = { s: 'down', front: 'down', n: 'up', back: 'up', e: 'right', right_side: 'right', w: 'left' };
export const direction = (row: string) => aliases[row] ?? row;
export function rowsOf(m: Candidate): Record<string, number> {
  return Object.fromEntries(Object.entries(m.rows).map(([name, row]) => [direction(name), row]));
}
export function covers(m: Candidate, anim: string, dir: string): boolean {
  const a = m.animations[anim];
  return a !== undefined && rowsOf(m)[dir] !== undefined && (!a.rows_only.length || a.rows_only.map(direction).includes(dir));
}
export function assertCoverage(old: Candidate, next: Candidate): void {
  for (const [anim, clip] of Object.entries(old.animations)) for (const dir of Object.keys(rowsOf(old))) {
    if (covers(old, anim, dir) && (!covers(next, anim, dir) || (next.animations[anim]?.frames ?? 0) < clip.frames)) {
      throw new ForgeError('make.coverage-loss', `기존 동작 보존 불가: ${anim}/${dir}. baseline 또는 원본/state/spec를 복원하세요`);
    }
  }
}
