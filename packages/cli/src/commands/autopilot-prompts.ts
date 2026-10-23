import { join } from 'node:path';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import { readJson, writeFileEnsured } from '../io/files.js';
import { fill } from '../prompts/assemble.js';
import { promptSha } from './prompts.js';
const schema = z.object({ version: z.literal(1), source: z.string(), common: z.string(), characters: z.record(z.string(), z.string()), templates: z.record(z.string(), z.object({ actor: z.string().optional(), text: z.string(), variants: z.record(z.string(), z.string()) })) });
export function autopilotPrompts(actor: string, kind: string, cwd: string, subject = '', fixes = '') {
  if (!/^[a-z][a-z0-9_]*$/.test(actor) || !/^[a-z][a-z-]*$/.test(kind)) throw new ForgeError('prompts.id', 'Invalid prompt actor/kind');
  const data = readJson(join(cwd, 'data/projects/seonggeom/prompts/autopilot.json'), schema), template = data.templates[kind];
  if (!template) throw new ForgeError('prompts.kind', 'Unknown autopilot kind');
  const character = data.characters[actor] ?? '';
  if (template.actor && actor !== template.actor) throw new ForgeError('prompts.actor', 'Prompt kind requires ' + template.actor);
  if (kind === 'prop' && !subject) throw new ForgeError('prompts.subject', 'Prop requires --note subject');
  const fixIds=fixes.split(',').filter(Boolean);
  const fixData=fixIds.length ? readJson(join(cwd,'data/projects/seonggeom/prompts/fixes.json'),z.object({autopilotFixes:z.record(z.string(),z.string())})).autopilotFixes : {};
  for (const id of fixIds) if (!fixData[id]) throw new ForgeError('prompts.fix','Unknown fix: '+id);
  const requests = Object.entries(template.variants).map(([variant, description]) => {
    const text = fill(template.text, { character, common: data.common, variant: fill(description, { subject }).trim(), subject }) + (fixIds.length ? "\n"+fixIds.map(id=>fixData[id]).join("\n")+"\n" : "");
    const file = `out/prompts/autopilot/${actor}/${kind}/${variant}${fixIds.length ? "__fix_"+fixIds.join("_") : ""}.txt`;
    writeFileEnsured(join(cwd, file), Buffer.from(text));
    return { variant, file, sha256: promptSha(text) };
  });
  return { ok: true as const, cmd: 'prompts', actor, kind, source: data.source, requests, next: requests.map(r => r.file) };
}

export function approvedProposalActor(actor: string, cwd: string): boolean {
 const data=readJson(join(cwd,'data/projects/seonggeom/prompts/autopilot.json'),schema);
 return Object.hasOwn(data.characters,actor);
}
