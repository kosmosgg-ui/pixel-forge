import { z } from 'zod';
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
    rig: z.string().min(1),
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
    animations: z.array(z.string().min(1)).default([]),
    seed: z.number().int().default(1),
  })
  .passthrough();

export type Spec = z.infer<typeof specSchema>;
export type Part = z.infer<typeof partSchema>;
export type SpecKind = z.infer<typeof specKindSchema>;
