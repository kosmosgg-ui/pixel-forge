import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { readJson } from '../io/files.js';
import { ForgeError } from '@pixel-forge/core';
import type { Bible } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';

/** pxl VM에는 파일 I/O가 없다. 검증된 바이블을 생성 소스에 주입해 색의 단일 기준을 유지한다. */
export function fxSource(source: string, bible: Bible, cwd: string): { file: string; text: string; colors?: string[] } {
  const text = readFileSync(source, 'utf8');
  if (!text.includes('pal(FX_PALETTE)')) return { file: source, text };
  const palette = bible.fxPalette;
  if (!palette || Object.keys(palette).length === 0) throw new ForgeError('fx.palette', '바이블 fxPalette가 필요합니다');
  const pairs = text.includes('FX_SLASH_SPECS') ? readJson(join(dirname(source), 'attack-specs.json'), z.object({ pairs: z.array(z.object({ reach: z.number().positive(), angle: z.number().positive().max(360) })) })).pairs : [];
  const prepared = text.replace('FX_SLASH_SPECS', JSON.stringify(pairs)).replace('pal(FX_PALETTE)', `pal(${JSON.stringify(palette)})`);
  const file = join(cwd, 'out', 'pxl-source', 'effects.px.js');
  writeFileEnsured(file, Buffer.from(prepared));
  return { file, text: prepared, colors: Object.values(palette) };
}
