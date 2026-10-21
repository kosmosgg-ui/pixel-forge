import { z } from 'zod';
import { motionOverrideSchema, poseSchema } from './anim-schema.js';
import { maskShapeSchema, partShapeSchema } from './shape-schema.js';

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
    /** 도형 축: bone = 도형 로컬 x축이 뼈 방향(팔다리·몸통), world = 화면 축 그대로(머리·모자 등) */
    orient: z.enum(['bone', 'world']).default('bone'),
  })
  .superRefine((p, ctx) => {
    if (p.shape.type === 'mask') {
      const r = maskShapeSchema.safeParse(p.shape);
      if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: ['shape', ...i.path] });
    } else if (p.material === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['material'], message: 'mask가 아닌 파츠는 material이 필요합니다' });
    }
  });

export const specSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, '소문자·숫자·_·- 만'),
    kind: specKindSchema,
    bible: z.string().min(1),
    sizeClass: z.string().min(1),
    /** true면 범위가 넘쳐도 크기 등급을 자동으로 올리지 않는다(bounds.canvas로 실패) */
    sizeClassLock: z.boolean().default(false),
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
    parts: z.array(partSchema).min(1).max(64),
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
    /** 공용 애니의 키 포즈 일부 덮어쓰기: 애니 id → 키 이름 → 뼈별 변화량(뼈 단위로 교체) */
    overrides: z.record(z.string().min(1), z.record(z.string().min(1), z.object({ pose: poseSchema }))).default({}),
    /** 절차 애니 힌트(바이블 motion 위에 키 단위 덮어쓰기) */
    motion: motionOverrideSchema.default({}),
    seed: z.number().int().default(1),
  })
  .passthrough();

export type Spec = z.infer<typeof specSchema>;
export type Part = z.infer<typeof partSchema>;
export type SpecKind = z.infer<typeof specKindSchema>;
