import { ForgeError } from '@pixel-forge/core';
import type { FixId, PromptView } from '@pixel-forge/spec';
import type { Kit } from './kit.js';

export const TURNAROUND = 'turnaround_all';

/** 사용자에게 내는 요청 1건 */
export interface PromptRequest {
  order: number;
  /** <action>_<view> 또는 turnaround_all */
  key: string;
  action: string;
  view: PromptView | 'all';
  /** 사용자가 저장할 파일 이름: <actorId>__<key>.png (한글·공백 없음) */
  file: string;
  references: string[];
  promptFile: string;
}

/** {{이름}} 치환만(조립 규칙 — 같은 데이터 → 같은 문자열). 빠진 이름은 오류 */
export function fill(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) throw new ForgeError('prompts.var', `문구 틀에 값이 없는 자리: {{${k}}}`);
    return v;
  }).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 파일 이름 규칙: <actorId>__<action>_<dir>.png — 소문자·숫자·_ 만 */
export const FILE_RULE = /^([a-z][a-z0-9_]*?)__([a-z][a-z0-9]*)_([a-z]+)\.png$/;
export const requestFile = (actorId: string, key: string) => `${actorId}__${key}.png`;
/** 턴어라운드 저장 파일(참조 이미지로 등록된다) */
export const turnaroundFile = (kit: Kit) => kit.actor.turnaroundFile ?? `${kit.actor.id}__turnaround.png`;

/** 생산 순서: 턴어라운드 → actor.produce 순서(동작마다 방향들) */
export function requestList(kit: Kit): PromptRequest[] {
  const id = kit.actor.id, turnFile = turnaroundFile(kit);
  const list: PromptRequest[] = [{ order: 1, key: TURNAROUND, action: 'turnaround', view: 'all', file: turnFile, references: [...kit.actor.references], promptFile: `out/prompts/${id}/${TURNAROUND}.txt` }];
  for (const p of kit.actor.produce) for (const view of p.views) {
    const key = `${p.action}_${view}`;
    list.push({ order: list.length + 1, key, action: p.action, view, file: requestFile(id, key), references: [...kit.actor.references, turnFile], promptFile: `out/prompts/${id}/${key}.txt` });
  }
  return list;
}

function common(kit: Kit): Record<string, string> {
  return {
    character: kit.actor.description, style: kit.base.style.join(', '), rules: [...kit.base.rules, ...kit.actor.mustKeep].join('; '),
    background: kit.actor.altBackground ? kit.base.background.alt : kit.base.background.default,
  };
}

/** 요청 문구 조립 */
export function promptText(kit: Kit, r: PromptRequest): string {
  if (r.view === 'all') return fill(kit.base.turnaround, common(kit));
  const a = kit.actions[r.action];
  if (!a) throw new ForgeError('prompts.action', `동작 데이터가 없습니다: ${r.action}`);
  return fill(kit.base.template, {
    ...common(kit), frames: String(a.frames), action: a.title, view: kit.base.views[r.view] ?? r.view,
    poses: a.poses.join('\n'), extra: a.viewExtra[r.view] ?? '',
  });
}

/** 고치기 문구: 고른 항목들 + 프레임 수 문장(필요하면) */
export function fixText(kit: Kit, ids: readonly FixId[], vars: { frame?: number; frames: number; frameCount?: boolean }): string {
  const v = { frame: String(vars.frame ?? 1), frames: String(vars.frames) };
  const parts = ids.map((id) => kit.fixes.fixes.find((f) => f.id === id)?.text ?? '').filter(Boolean).map((t) => fill(t, v).trim());
  if (vars.frameCount) parts.unshift(fill(kit.fixes.frameCount, v).trim());
  return parts.join('\n') + '\n';
}
