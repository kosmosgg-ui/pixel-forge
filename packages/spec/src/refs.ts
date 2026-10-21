import type { Bible } from './bible-schema.js';
import type { Rig } from './rig-schema.js';
import type { Spec } from './spec-schema.js';

/** 참조 무결성: 재질∈바이블, 뼈∈리그, sizeClass∈sizeClasses, role∈roleColorKey. 오류 문구 목록(빈 배열 = 통과) */
export function checkRefs(spec: Spec, bible: Bible, rig: Rig): string[] {
  const errors: string[] = [];
  if (spec.bible !== bible.id) errors.push(`bible: ${spec.bible} ≠ 불러온 바이블 ${bible.id}`);
  const rigId = spec.rig ?? bible.defaultRig;
  if (rigId === undefined) errors.push('rig: Spec에도 바이블 defaultRig에도 리그가 없습니다');
  else if (rigId !== rig.id) errors.push(`rig: ${rigId} ≠ 불러온 리그 ${rig.id}`);
  if (!(spec.sizeClass in bible.sizeClasses)) errors.push(`sizeClass: ${spec.sizeClass}이(가) 바이블 sizeClasses에 없습니다`);
  if (spec.role !== undefined && !(spec.role in bible.roleColorKey)) errors.push(`role: ${spec.role}이(가) 바이블 roleColorKey에 없습니다`);
  spec.parts.forEach((p, i) => {
    const where = `parts[${i}]${p.name ? `(${p.name})` : ''}`;
    if (!(p.bone in rig.bones)) errors.push(`${where}.bone: 리그에 없는 뼈 ${p.bone}`);
    const mats = p.shape.type === 'mask' ? Object.values(p.shape.legend).map((e) => e.material) : [p.material ?? ''];
    for (const m of mats) if (!(m in bible.materials)) errors.push(`${where}.material: 바이블에 없는 재질 ${m}`);
  });
  if (spec.eyes) {
    const [mat, step] = spec.eyes.color.split(':');
    if (!(spec.eyes.bone in rig.bones)) errors.push(`eyes.bone: 리그에 없는 뼈 ${spec.eyes.bone}`);
    const m = bible.materials[mat ?? ''];
    if (!m) errors.push(`eyes.color: 바이블에 없는 재질 ${mat ?? ''}`);
    else if (Number(step) >= m.steps) errors.push(`eyes.color: ${mat ?? ''}의 단계는 0~${m.steps - 1}`);
  }
  return errors;
}
