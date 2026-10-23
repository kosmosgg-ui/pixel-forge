import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import { normalizePortrait, portraitConsistency, portraitPanels } from '@pixel-forge/import';
import { decodePng, encodePng } from '../io/png.js';
import { writeFileEnsured } from '../io/files.js';
import { resolveInside } from '../io/paths.js';
import { resolveOut } from '../io/targets.js';

const EXPRESSIONS: Record<string, string[]> = { sera: ['default', 'determined', 'smile', 'surprised'], leona: ['default', 'smile'], clerk: ['default'], mia: ['default'] };
const inputSchema = z.object({ as: z.string().regex(/^(sera|leona|clerk|mia|npc)\/[a-z][a-z0-9_]*$/), at: z.string().optional(), out: z.string().optional() });
function targets(character: string, set: string) {
  if (character === 'npc' && set.endsWith('set')) return [{ character: 'clerk', expression: 'default' }, { character: 'mia', expression: 'default' }];
  const expressions = EXPRESSIONS[character];
  if (!expressions) throw new ForgeError('portrait.character', 'Unknown portrait character');
  const selected = set.endsWith('set') ? expressions : expressions.filter(e => e === set);
  if (!selected.length) throw new ForgeError('portrait.expression', 'Use portrait_set or a known expression ID');
  return selected.map(expression => ({ character, expression }));
}
function promptRecord(cwd: string) {
  const path = 'docs/instructions/PROMPTS_GPT_20261023.md';
  return { path, sha256: createHash('sha256').update(readFileSync(join(cwd, path))).digest('hex') };
}
/** P13 addendum17: approved illustration exception, no palette/nearest conversion. */
export function intakePortrait(file: string, cwd: string, options: { as?: string; at?: string; out?: string } = {}) {
  const o = inputSchema.parse(options), src = resolveInside(cwd, file), bytes = readFileSync(src), source = decodePng(bytes);
  const [character = '', set = ''] = o.as.split('/'), entries = targets(character, set);
  const panels = portraitPanels(source, entries.length as 1 | 2 | 4).map(normalizePortrait);
  const deviation = portraitConsistency(panels.map(p => p.qa.headWidthProxy)), prompt = promptRecord(cwd);
  const sha = createHash('sha256').update(bytes).digest('hex'), at = o.at ?? statSync(src).mtime.toISOString();
  const stamp = `${at.replace(/[-:]/g, '').replace(/\.\d+/, '')}_${sha.slice(0, 8)}`;
  const raw = join('data', 'import', character, 'portraits', set, stamp + '.png');
  writeFileEnsured(join(cwd, raw), bytes);
  writeFileSync(join(cwd, raw.replace(/\.png$/, '.intake.json')), JSON.stringify({ origin: 'chatgpt-manual', sourceName: basename(src), sha256: sha, createdAt: at, promptRecord: prompt.path, promptSha256: prompt.sha256, size: [source.w, source.h] }, null, 2) + '\n');
  const destinations: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i], panel = panels[i];
    if (!entry || !panel) throw new ForgeError('portrait.grid', 'Panel count mismatch');
    const local = join(cwd, 'out', 'portraits', entry.character), out = o.out ? resolveOut(cwd, o.out) : join(cwd, 'out');
    const dest = resolveInside(out, join('art', 'candidates', 'portraits', entry.character));
    const assetId = `portrait_${entry.character}_${entry.expression}`;
    const manifest = {
      assetId, kind: 'portrait', quality: 'candidate', size: [720, 720], expression: entry.expression, sourceSha256: sha,
      processingStages: ['split', 'green-key-remove', 'edge-despill-2px', 'trim', 'linear-premultiplied-downscale', 'head-y40-center'],
      provenance: { assetId, creator: 'user via ChatGPT', sourceUrl: '', license: 'OpenAI 이용약관에 따른 사용자 생성물(사용자 확인 필요)', aiUsed: true, promptRecord: prompt.path, editedBy: 'pixel-forge portrait intake', sourceFile: raw, exportFile: entry.expression + '.png', rightsReviewed: false, creditText: '' },
      qa: { ...panel.qa, headDeviation: deviation, pass: panel.qa.pass && deviation <= .08, headMetric: 'upper-quarter silhouette width proxy; anatomical consistency requires human review' },
    };
    for (const folder of new Set([local, dest])) {
      writeFileEnsured(join(folder, entry.expression + '.png'), encodePng(panel.image));
      writeFileSync(join(folder, entry.expression + '_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    destinations.push(relative(cwd, dest));
  }
  return { ok: true as const, cmd: 'intake', kind: 'portrait', actor: character, count: entries.length, destinations, qa: { pass: panels.every(p => p.qa.pass) && deviation <= .08, headDeviation: deviation } };
}
