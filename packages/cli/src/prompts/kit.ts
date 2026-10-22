import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeError } from '@pixel-forge/core';
import { promptActionSchema, promptActorSchema, promptBaseSchema, promptFixesSchema, type PromptAction, type PromptActor, type PromptBase, type PromptFixes } from '@pixel-forge/spec';
import { readJson } from '../io/files.js';

/** 한 캐릭터의 요청 문구 데이터(data/projects/<project>/prompts/) */
export interface Kit {
  project: string;
  base: PromptBase;
  actor: PromptActor;
  actions: Record<string, PromptAction>;
  fixes: PromptFixes;
}

/** actorId로 프로젝트를 찾는다(data/projects/*\/prompts/actors/<actorId>.json) — 게임 이름을 코드에 넣지 않으려는 것 */
export function loadKit(actorId: string, cwd: string): Kit {
  if (!/^[a-z][a-z0-9_]*$/.test(actorId)) throw new ForgeError('prompts.actor', `actorId는 소문자·숫자·_ 만: ${actorId}`);
  const projects = join(cwd, 'data', 'projects');
  const project = (existsSync(projects) ? readdirSync(projects).sort() : []).find((p) => existsSync(join(projects, p, 'prompts', 'actors', `${actorId}.json`)));
  if (!project) throw new ForgeError('prompts.actor', `요청 문구 데이터가 없습니다: data/projects/<프로젝트>/prompts/actors/${actorId}.json`);
  const dir = join(projects, project, 'prompts');
  const actor = readJson(join(dir, 'actors', `${actorId}.json`), promptActorSchema);
  const actions: Record<string, PromptAction> = {};
  // 캐릭터 전용 동작(actions/<actorId>/<id>.json)이 있으면 그것, 없으면 공용(actions/<id>.json) — 고블린 walk와 오크 walk는 포즈가 다르다
  for (const id of new Set(actor.produce.map((p) => p.action))) {
    const own = join(dir, 'actions', actorId, `${id}.json`);
    actions[id] = readJson(existsSync(own) ? own : join(dir, 'actions', `${id}.json`), promptActionSchema);
  }
  return { project, base: readJson(join(dir, 'base.json'), promptBaseSchema), actor, actions, fixes: readJson(join(dir, 'fixes.json'), promptFixesSchema) };
}
