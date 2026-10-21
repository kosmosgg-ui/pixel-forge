import { join, relative, resolve } from 'node:path';
import { buildBiblePalette, paletteSheet, scaleNearest, toRGBA } from '@pixel-forge/core';
import { bibleColorsSchema, rulesColorSchema } from '@pixel-forge/spec';
import { encodePng } from '../io/png.js';
import { readJson, writeFileEnsured } from '../io/files.js';

const SHEET_SCALE = 4;

/** 인자가 .json이면 경로, 아니면 data/bibles/<id>.bible.json */
export function resolveBiblePath(ref: string, cwd: string): string {
  return ref.endsWith('.json') ? resolve(cwd, ref) : join(cwd, 'data', 'bibles', `${ref}.bible.json`);
}

export function paletteCommand(ref: string, cwd: string) {
  const bible = readJson(resolveBiblePath(ref, cwd), bibleColorsSchema);
  const rules = readJson(join(cwd, 'data', 'rules', 'default.rules.json'), rulesColorSchema);
  const bp = buildBiblePalette(bible, rules);
  const sheet = scaleNearest(paletteSheet(bp, { swatch: 4, gap: 1 }), SHEET_SCALE);
  const out = join(cwd, 'out', 'palette', `${bible.id}.png`);
  writeFileEnsured(out, encodePng({ w: sheet.w, h: sheet.h, rgba: toRGBA(sheet, bp.palette) }));
  return {
    ok: true as const,
    cmd: 'palette',
    bible: bible.id,
    materials: Object.keys(bp.ramps).length,
    colors: bp.palette.colors.length - 1,
    out: relative(cwd, out),
  };
}
