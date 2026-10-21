import { z } from 'zod';
import { hexColorSchema, materialSchema } from './color-schemas.js';

const sizePx = z.tuple([z.number().int().min(1), z.number().int().min(1)]);
export const outlineModeSchema = z.enum(['selout', 'dark', 'none']);

export const bibleSchema = z
  .object({
    id: z.string().min(1),
    internalResolution: sizePx.optional(),
    view: z.enum(['side', 'topdown', 'iso']),
    directions: z.union([z.literal(1), z.literal(4), z.literal(8)]),
    sizeClasses: z.record(z.string().min(1), sizePx),
    pivot: z.enum(['bottom-center', 'center']),
    facing: z.enum(['right', 'left']),
    background: hexColorSchema,
    light: z.object({ dir: z.tuple([z.number(), z.number(), z.number()]), ambient: z.number().min(0).max(1) }),
    outline: z.object({ mode: outlineModeSchema, globalColor: hexColorSchema }).passthrough(),
    colorBudget: z.record(z.string().min(1), z.number().int().min(1)),
    materials: z.record(z.string().min(1), materialSchema),
    fxColors: z.array(hexColorSchema),
    roleColorKey: z.record(z.string().min(1), z.string().min(1)).default({}),
    /** Spec이 rig를 생략하면 쓰는 리그 id */
    defaultRig: z.string().min(1).optional(),
  })
  .passthrough()
  .superRefine((b, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (Object.keys(b.materials).length === 0) issue(['materials'], '재질이 하나 이상 필요합니다');
    const sc = Object.keys(b.sizeClasses).sort().join(',');
    if (Object.keys(b.colorBudget).sort().join(',') !== sc) issue(['colorBudget'], 'colorBudget 키는 sizeClasses 키와 같아야 합니다');
    for (const [role, m] of Object.entries(b.roleColorKey)) if (!(m in b.materials)) issue(['roleColorKey', role], `없는 재질: ${m}`);
    for (const [id, m] of Object.entries(b.materials)) {
      if (m.shareWith !== undefined && (m.shareWith === id || !(m.shareWith in b.materials))) {
        issue(['materials', id, 'shareWith'], `없는 재질이거나 자기 자신입니다: ${m.shareWith}`);
      }
    }
  });

export type Bible = z.infer<typeof bibleSchema>;
