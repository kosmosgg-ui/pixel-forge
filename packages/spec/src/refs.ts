import type { AnimsFile } from './anim-schema.js';
import type { Bible } from './bible-schema.js';
import type { Rig } from './rig-schema.js';
import type { Spec } from './spec-schema.js';

/** 참조 무결성: 재질∈바이블, 뼈∈리그, sizeClass∈sizeClasses, role∈roleColorKey. 오류 문구 목록(빈 배열 = 통과) */
export function checkRefs(spec: Spec, bible: Bible, rig: Rig): string[] {
  const errors: string[] = [];
  if (spec.bible !== bible.id) errors.push(`bible: ${spec.bible} ≠ 불러온 바이블 ${bible.id}`);
  const rigId = spec.rig ?? bible.sizeClassOptions[spec.sizeClass]?.rig ?? bible.defaultRig;
  if (rigId === undefined) errors.push('rig: Spec에도 바이블 defaultRig에도 리그가 없습니다');
  else if (rigId !== rig.id) errors.push(`rig: ${rigId} ≠ 불러온 리그 ${rig.id}`);
  if (!(spec.sizeClass in bible.sizeClasses)) errors.push(`sizeClass: ${spec.sizeClass}이(가) 바이블 sizeClasses에 없습니다`);
  if (spec.role !== undefined && !(spec.role in bible.roleColorKey)) errors.push(`role: ${spec.role}이(가) 바이블 roleColorKey에 없습니다`);
  spec.parts.forEach((p, i) => {
    const where = `parts[${i}]${p.name ? `(${p.name})` : ''}`;
    if (!(p.bone in rig.bones)) errors.push(`${where}.bone: 리그에 없는 뼈 ${p.bone}`);
    if (p.shape.type === 'grid') {
      errors.push(...gridRefs(p.shape.legend, bible, `${where}.shape`));
      for (const [k, g] of Object.entries(p.variants ?? {})) errors.push(...gridRefs(g.legend, bible, `${where}.variants.${k}`));
      return;
    }
    const mats = p.shape.type === 'mask' ? Object.values(p.shape.legend).map((e) => e.material) : [p.material ?? ''];
    for (const m of mats) if (!(m in bible.materials)) errors.push(`${where}.material: 바이블에 없는 재질 ${m}`);
  });
  if (spec.grid) errors.push(...gridRefs(spec.grid.legend, bible, 'grid'));
  for (const [a, list] of Object.entries(spec.frames ?? {})) list.forEach((f, i) => {
    const g = f.grid ?? f.patch;
    if (g) errors.push(...gridRefs(g.legend, bible, `frames.${a}[${i}]`));
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

/** 애니 참조: spec.animations ∈ anims, overrides의 애니·키, 모든 포즈·fx 뼈 ∈ 리그, fx 색 ∈ bible.fxColors */
export function checkAnimRefs(spec: Spec, anims: AnimsFile, rig: Rig, bible: Bible): string[] {
  const errors: string[] = [];
  if (anims.rig !== rig.id) errors.push(`anims.rig: ${anims.rig} ≠ ${rig.id}`);
  for (const a of spec.animations) if (!(a in anims.anims)) errors.push(`animations: 공용 애니에 없는 ${a}`);
  if (spec.attackAnim !== undefined && !(spec.attackAnim in anims.anims)) errors.push(`attackAnim: 공용 애니에 없는 ${spec.attackAnim}`);
  const bones = (pose: Record<string, unknown>, where: string) => {
    for (const b of Object.keys(pose)) if (!(b in rig.bones)) errors.push(`${where}: 리그에 없는 뼈 ${b}`);
  };
  for (const [id, a] of Object.entries(anims.anims)) a.keys.forEach((k) => bones(k.pose, `anims.${id}.${k.name}`));
  for (const [name, fx] of Object.entries(anims.fx)) {
    if (fx.type !== 'flash' && !(fx.bone in rig.bones)) errors.push(`fx.${name}: 리그에 없는 뼈 ${fx.bone}`);
    if (fx.color >= bible.fxColors.length) errors.push(`fx.${name}: bible.fxColors에 없는 순번 ${fx.color}`);
  }
  for (const [id, keys] of Object.entries(spec.overrides)) {
    const anim = anims.anims[id];
    if (!anim) { errors.push(`overrides.${id}: 없는 애니`); continue; }
    for (const [key, o] of Object.entries(keys)) {
      if (!anim.keys.some((k) => k.name === key)) errors.push(`overrides.${id}.${key}: 없는 키`);
      bones(o.pose, `overrides.${id}.${key}`);
    }
  }
  return errors;
}

/** 그리드 범례 "<재질>:<단계>"(·"@eye:<재질>:<단계>")의 재질이 바이블에 있고 단계가 램프 안인지 */
export function gridRefs(legend: Readonly<Record<string, string>>, bible: Bible, where: string): string[] {
  const errors: string[] = [];
  for (const [ch, v] of Object.entries(legend)) {
    if (v === '@outline' || v === '@eye') continue;
    const [mat = '', step = '0'] = v.replace(/^@eye:/, '').split(':');
    const m = bible.materials[mat];
    if (!m) errors.push(`${where}.legend.${ch}: 바이블에 없는 재질 ${mat}`);
    else if (Number(step) >= m.steps) errors.push(`${where}.legend.${ch}: ${mat}의 단계는 0~${m.steps - 1}`);
  }
  return errors;
}
