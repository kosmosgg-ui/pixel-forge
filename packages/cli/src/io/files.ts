import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ZodType, ZodTypeDef } from 'zod';
import { ForgeError } from '@pixel-forge/core';

/** 경계 검증: JSON을 읽어 스키마로 한 번만 검사한다 */
export function readJson<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>): T {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new ForgeError('io.not-found', `파일을 읽을 수 없습니다: ${path}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ForgeError('io.json', `JSON 형식 오류: ${path}`, { reason: e instanceof Error ? e.message : String(e) });
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ForgeError('spec.invalid', `스키마 위반: ${path} (${issues[0] ?? ''})`, { issues });
  }
  return r.data;
}

export function writeFileEnsured(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}
