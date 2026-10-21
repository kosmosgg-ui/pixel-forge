import { z } from 'zod';

const vec2 = z.tuple([z.number(), z.number()]);
const size = z.number().int().min(1).max(256);
const angle = z.number().optional();

export const lineShapeSchema = z.object({ type: z.literal('line'), to: vec2, from: vec2.optional() });
export const rectShapeSchema = z.object({ type: z.literal('rect'), w: size, h: size, chamfer: z.number().int().min(0).optional(), angleDeg: angle });
export const ellipseShapeSchema = z.object({ type: z.literal('ellipse'), w: size, h: size, angleDeg: angle });
export const capsuleShapeSchema = z.object({ type: z.literal('capsule'), len: size, w: size, angleDeg: angle });
export const polyShapeSchema = z.object({
  type: z.literal('poly'),
  pts: z.array(vec2).min(3).max(12),
  normalHint: z.tuple([z.number(), z.number(), z.number()]).optional(),
  angleDeg: angle,
});
export const maskShapeSchema = z
  .object({
    type: z.literal('mask'),
    origin: z.tuple([z.number().int(), z.number().int()]),
    rows: z.array(z.string().min(1).max(16)).min(1).max(16),
    legend: z.record(z.string().length(1), z.object({ material: z.string().min(1), shade: z.number().int().min(0).optional() })),
  })
  .superRefine((m, ctx) => {
    const w = m.rows[0]?.length ?? 0;
    m.rows.forEach((row, y) => {
      if (row.length !== w) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', y], message: '모든 행의 길이가 같아야 합니다' });
      for (const ch of row) if (ch !== '.' && !(ch in m.legend)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', y], message: `legend에 없는 문자: ${ch}` });
    });
  });

export const partShapeSchema = z.discriminatedUnion('type', [
  lineShapeSchema, rectShapeSchema, ellipseShapeSchema, capsuleShapeSchema, polyShapeSchema,
  // discriminatedUnion은 ZodEffects를 받지 않으므로 mask의 행 검사는 partSchema에서 다시 건다
  maskShapeSchema.innerType(),
]);

export type PartShape = z.infer<typeof partShapeSchema>;
export type MaskShape = z.infer<typeof maskShapeSchema>;
