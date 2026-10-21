import { ForgeError } from '@pixel-forge/core';
import { assertImplemented } from '@pixel-forge/render';
import { checkAnimRefs, checkRefs } from '@pixel-forge/spec';
import { loadProject, type Project } from '../io/project.js';

/** 스키마 + 참조 무결성 + 구현 범위. 실패하면 ForgeError(종료 코드 1) */
export function validateProject(p: Project): void {
  const errors = checkRefs(p.spec, p.bible, p.rig);
  if (p.anims) errors.push(...checkAnimRefs(p.spec, p.anims, p.rig, p.bible));
  else if (p.spec.animations.length) errors.push(`animations: 리그 ${p.rig.id}의 공용 애니 파일(data/rigs/${p.rig.id}.anims.json)이 없습니다`);
  if (errors.length) throw new ForgeError('spec.refs', `참조 오류 ${errors.length}개: ${errors[0] ?? ''}`, { errors });
  assertImplemented(p.spec, p.bible);
}

export function validateCommand(specPath: string, cwd: string) {
  const p = loadProject(specPath, cwd);
  validateProject(p);
  return { ok: true as const, cmd: 'validate', id: p.spec.id, kind: p.spec.kind, bible: p.bible.id, rig: p.rig.id, parts: p.spec.parts.length };
}
