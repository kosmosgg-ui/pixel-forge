import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import type { Bible } from '@pixel-forge/spec';
import { writeFileEnsured } from '../io/files.js';

/** pxl VM에는 파일 I/O가 없다. 검증된 바이블을 생성 소스에 주입해 색의 단일 기준을 유지한다. */
export function fxSource(source: string, bible: Bible, cwd: string): { file: string; text: string; colors?: string[] } {
  const text = readFileSync(source, 'utf8');
  if (!text.includes('pal(FX_PALETTE)')) return { file: source, text };
  const palette = bible.fxPalette;
  if (!palette || Object.keys(palette).length === 0) throw new ForgeError('fx.palette', '바이블 fxPalette가 필요합니다');
  const prepared = text.replace('pal(FX_PALETTE)', `pal(${JSON.stringify(palette)})`);
  const file = join(cwd, 'out', 'pxl-source', 'effects.px.js');
  writeFileEnsured(file, Buffer.from(prepared));
  return { file, text: prepared, colors: Object.values(palette) };
}
