import { createHash } from 'node:crypto';
import { ForgeError } from '@pixel-forge/core';
import { join, relative } from 'node:path';
import { writeFileEnsured } from '../io/files.js';
import { loadKit, type Kit } from '../prompts/kit.js';
import { promptText, requestList, type PromptRequest } from '../prompts/assemble.js';
import { nextRequests, readState, writeState, type ActorState } from '../prompts/state.js';

/** 요청 문구 sha256(intake 기록 promptSha256 — 어떤 문구로 만든 원본인지) */
export const promptSha = (text: string) => createHash('sha256').update(text).digest('hex');

const VIEW_KO: Record<string, string> = { side: '옆(오른쪽)', front: '정면', back: '뒷면', all: '정면·옆·뒷면' };

/** CHECKLIST.md — 사람이 위에서부터 따라 하는 표. 상태 열은 intake·make가 남긴 state.json에서 */
export function checklist(kit: Kit, list: readonly PromptRequest[], state: ActorState): string {
  const left = list.filter((r) => state.items[r.key]?.status !== '합격').length;
  const lines = [
    `# ${kit.actor.id} — ChatGPT 이미지 요청 목록`, '',
    `남은 요청 ${left} / ${list.length}. ChatGPT에서 참조 이미지를 첨부하고 요청 문구 파일 내용을 그대로 보낸 뒤, 결과를 **저장 파일명** 그대로 저장해 전달한다.`, '',
    '| 순서 | 저장 파일명 | 첨부할 참조 이미지 | 요청 문구 파일 | 상태 |', '| --- | --- | --- | --- | --- |',
    ...list.map((r) => `| ${r.order} | \`${r.file}\` | ${r.references.map((f) => `\`${f}\``).join(', ')} | \`${r.promptFile}\` (${r.action} · ${VIEW_KO[r.view] ?? r.view}) | ${state.items[r.key]?.status ?? '대기'}${state.items[r.key]?.note ? ` (${state.items[r.key]?.note})` : ''} |`),
  ];
  return lines.join('\n') + '\n';
}

/** forge prompts <actorId> → out/prompts/<actorId>/{<key>.txt, CHECKLIST.md} + 한 줄 요약 */
export function promptsCommand(actorId: string, cwd: string, o: { retake?: string; note?: string } = {}) {
  const kit = loadKit(actorId, cwd);
  const list = requestList(kit);
  const state = readState(cwd, actorId);
  // --retake a,b --note 이유: 사람 결정으로 다시 받을 항목(예: G2 U1 보드 공격·피격 — 크기·궤적 문제)
  if (o.retake) {
    for (const key of o.retake.split(',').filter(Boolean)) {
      if (!list.some((r) => r.key === key)) throw new ForgeError('prompts.key', `${actorId}의 요청 목록에 없는 항목: ${key}`);
      state.items[key] = { status: '재요청', fails: state.items[key]?.fails ?? 0, ...(o.note ? { note: o.note } : {}) };
    }
    writeState(cwd, actorId, state);
  }
  for (const r of list) writeFileEnsured(join(cwd, r.promptFile), Buffer.from(promptText(kit, r)));
  const out = join(cwd, 'out', 'prompts', actorId, 'CHECKLIST.md');
  writeFileEnsured(out, Buffer.from(checklist(kit, list, state)));
  const left = list.filter((r) => state.items[r.key]?.status !== '합격');
  return { ok: true as const, cmd: 'prompts', actor: actorId, requests: list.length, remaining: left.length, next: nextRequests(list, state).map((r) => r.file), out: relative(cwd, out) };
}
