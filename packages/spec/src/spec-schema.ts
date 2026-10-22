import { z } from 'zod';
import { motionOverrideSchema, poseSchema } from './anim-schema.js';
import { checkGridShape, frameGridSchema, gridPatchSchema, gridShapeSchema, maskShapeSchema, partShapeSchema } from './shape-schema.js';

export const specKindSchema = z.enum(['character', 'item', 'tile', 'fx', 'ui']);

export const partSchema = z
  .object({
    bone: z.string().min(1),
    shape: partShapeSchema,
    /** mask 파츠는 legend가 재질을 정하므로 생략 */
    material: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    /** 같은 뼈·층 안 그리기 순서 보정 */
    z: z.number().int().default(0),
    /** 파츠 원점: 뼈 관절(joint), 뼈 중간(mid), 뼈 끝(end) */
    anchor: z.enum(['joint', 'mid', 'end']).default('mid'),
    /** anchor에서 뼈 로컬 좌표로 더 옮길 양(px) */
    at: z.tuple([z.number(), z.number()]).default([0, 0]),
    /** 손에 든 무기·소품. 정리 단계 보호 + 두께 ≥ rules.form.heldMinWidth + QA form.held-visible 대상 */
    held: z.boolean().default(false),
    /** 장식용 얇은 획. 1px(form.outline-thin)은 decorative 파츠만 허용 */
    decorative: z.boolean().default(false),
    /** Spec signature(과장할 특징 1개)에 속하는 파츠 */
    signature: z.boolean().default(false),
    /** 도형 축: bone = 도형 로컬 x축이 뼈 방향(팔다리·몸통), world = 화면 축 그대로(머리·모자 등) */
    orient: z.enum(['bone', 'world']).default('bone'),
    /** 아톰 모드: 각도별로 따로 그린 그리드(키 = 도, 예 "0", "45", "-45", "90"). 가장 가까운 변형 + 남은 각도만 RotSprite */
    variants: z.record(z.string().regex(/^-?\d+$/), gridShapeSchema).optional(),
    /** 회전 금지(머리 아톰): ±15° 이내는 1px 이동, 그 밖은 변형·RotSprite */
    upright: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (p.shape.type === 'mask') {
      const r = maskShapeSchema.safeParse(p.shape);
      if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: ['shape', ...i.path] });
    } else if (p.shape.type === 'grid') {
      checkGridShape(p.shape, ctx, ['shape']);
    } else if (p.material === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['material'], message: 'mask·grid가 아닌 파츠는 material이 필요합니다' });
    }
    for (const [k, g] of Object.entries(p.variants ?? {})) checkGridShape(g, ctx, ['variants', k]);
  });

const gridFrameSchema = z.object({
  grid: frameGridSchema.optional(), patch: gridPatchSchema.optional(), ms: z.number().int().min(1),
  fx: z.literal('flash').optional(),
  /** 발이 바닥에 붙은 프레임(baseline.stable 대상) — 쓰러짐 등은 false */
  grounded: z.boolean().default(true),
});
export type GridFrame = z.infer<typeof gridFrameSchema>;

export const specSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, '소문자·숫자·_·- 만'),
    kind: specKindSchema,
    bible: z.string().min(1),
    sizeClass: z.string().min(1),
    /** true면 범위가 넘쳐도 크기 등급을 자동으로 올리지 않는다(bounds.canvas로 실패) */
    sizeClassLock: z.boolean().default(false),
    /** 과장할 특징 1개(예: "ears", "skull") — signature: true 파츠의 rest 면적이 signatureRange 밖이면 경고(form.signature) */
    signature: z.string().min(1).optional(),
    /** 생략하면 bible.defaultRig */
    rig: z.string().min(1).optional(),
    /** bible.roleColorKey의 키 (선택) */
    role: z.string().min(1).optional(),
    proportions: z
      .object({
        /** 캐릭터 키(px). 리그 전체를 rig.baseHeight 대비 이 비율로 축척 */
        height: z.number().positive().optional(),
        headRatio: z.number().positive().optional(),
        bulk: z.number().positive().optional(),
      })
      .default({}),
    /** shapes = 도형 조합(기본), frames = 프레임마다 픽셀 그리드 직접 설계, atoms = 파츠가 그리드 아톰, prerender = 3D 모델을 Blender로 렌더해 도트로(P7-alt 실험) */
    mode: z.enum(['shapes', 'frames', 'atoms', 'prerender']).default('shapes'),
    parts: z.array(partSchema).max(64).default([]),
    /** 프레임 모드: rest(=base) 그리드 */
    grid: frameGridSchema.optional(),
    /** 프레임 모드: 애니 → 프레임들(grid 전체 또는 patch). 프리렌더 모드: 애니 → 원본 액션에서 뽑을 프레임 번호(키 포즈 중심) */
    frames: z.record(z.string().min(1), z.union([z.array(gridFrameSchema).min(1), z.array(z.number().int().min(0)).min(1)])).optional(),
    /** 프리렌더: 모델 파일(data/models/<id>/…), 애니 이름 → 모델 액션 이름, 방향 수, 목표 키(px), 카메라 */
    model: z.string().min(1).optional(),
    actions: z.record(z.string().min(1), z.string().min(1)).optional(),
    /** 1(기본, se + 엔진 좌우 반전) | 4(눈이 보이는 방향에서 고름) | 8 | 방향 이름 목록(s·se·e·ne·n·nw·w·sw) */
    directions: z.union([z.literal(8), z.literal(4), z.literal(1), z.array(z.enum(['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'])).min(1)]).default(1),
    height: z.number().int().min(8).optional(),
    /** 프리렌더: 숨길 모델 오브젝트(소품 고르기, 예: 기사의 다른 무기·방패) */
    hide: z.array(z.string().min(1)).default([]),
    /** iso = 내려다보는 30°, side = 측면 3/4(10°) */
    camera: z.enum(['iso', 'side']).default('iso'),
    /** 프레임 모드: 반복 재생할 애니 */
    loop: z.array(z.string().min(1)).default(['idle']),
    /** rule: form.face — 뼈 중간점에서 화면 축으로 pos만큼. 3/4 리그면 먼 쪽 눈(1px)이 자동으로 붙는다 */
    eyes: z
      .object({
        bone: z.string().min(1),
        pos: z.tuple([z.number().int(), z.number().int()]),
        /** 세로 픽셀 수 */
        size: z.union([z.literal(1), z.literal(2)]),
        /** "<재질>:<램프 단계>" */
        color: z.string().regex(/^[^:]+:\d+$/, '"<재질>:<단계>" 형식이어야 합니다'),
      })
      .optional(),
    animations: z.array(z.string().min(1)).default([]),
    /** attack 자리에 쓸 공용 애니(예 "shoot" — 궁수). 출력 이름은 attack 그대로(게임 쪽 코드가 같은 태그를 쓰게) */
    attackAnim: z.string().min(1).optional(),
    /** 공용 애니의 키 포즈 일부 덮어쓰기: 애니 id → 키 이름 → 뼈별 변화량(뼈 단위로 교체) */
    overrides: z.record(z.string().min(1), z.record(z.string().min(1), z.object({ pose: poseSchema }))).default({}),
    /** 절차 애니 힌트(바이블 motion 위에 키 단위 덮어쓰기) */
    motion: motionOverrideSchema.default({}),
    seed: z.number().int().default(1),
  })
  .passthrough()
  .superRefine((s, ctx) => {
    const issue = (path: string[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (s.mode === 'frames') {
      if (!s.grid) issue(['grid'], '프레임 모드는 grid(rest)가 필요합니다');
      if (!s.frames) issue(['frames'], '프레임 모드는 frames가 필요합니다');
      for (const [a, list] of Object.entries(s.frames ?? {})) list.forEach((f, i) => {
        if (typeof f === 'number') issue(['frames', a, String(i)], '프레임 모드 frames는 { grid | patch, ms } 목록입니다');
        else if (!f.grid === !f.patch) issue(['frames', a, String(i)], 'grid와 patch 중 하나만 있어야 합니다');
      });
    } else if (s.mode === 'prerender') {
      if (!s.model) issue(['model'], '프리렌더 모드는 model이 필요합니다');
      if (!s.height) issue(['height'], '프리렌더 모드는 height(목표 키 px)가 필요합니다');
      if (!s.actions || !Object.keys(s.actions).length) issue(['actions'], '프리렌더 모드는 actions가 필요합니다');
      for (const [a, list] of Object.entries(s.frames ?? {})) {
        if (!s.actions?.[a]) issue(['frames', a], `actions에 없는 애니: ${a}`);
        if (list.some((f) => typeof f !== 'number')) issue(['frames', a], '프리렌더 frames는 프레임 번호 목록입니다');
      }
    } else if (s.parts.length === 0) issue(['parts'], '파츠가 하나 이상 필요합니다');
  });

export type Spec = z.infer<typeof specSchema>;
export type Part = z.infer<typeof partSchema>;
export type SpecKind = z.infer<typeof specKindSchema>;

/** 프레임 모드 frames(그리드 프레임 목록만) — 프리렌더의 프레임 번호 목록은 뺀다 */
export function gridFramesOf(s: Spec): Record<string, GridFrame[]> {
  return Object.fromEntries(Object.entries(s.frames ?? {}).flatMap(([k, v]) => (v.every((f): f is GridFrame => typeof f !== 'number') ? [[k, v]] : [])));
}

/** 프리렌더 frames(애니 → 원본 프레임 번호). 지정하지 않은 애니는 프레임 0만 */
export function sampleFramesOf(s: Spec): Record<string, number[]> {
  return Object.fromEntries(Object.keys(s.actions ?? {}).map((k) => {
    const v = s.frames?.[k];
    return [k, v && v.every((f): f is number => typeof f === 'number') ? v : [0]];
  }));
}
