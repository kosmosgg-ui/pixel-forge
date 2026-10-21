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

/** 그리드 범례 값: "<재질>:<단계>" | "@eye"(검은 눈, 정리 보호) | "@eye:<재질>:<단계>"(그 색 눈) | "@outline"(외곽선색 강제) */
export const gridLegendValueSchema = z.string().regex(/^(@outline|@eye(:[^:@]+:\d+)?|[^:@]+:\d+)$/, '"<재질>:<단계>", "@eye", "@eye:<재질>:<단계>", "@outline" 중 하나');

/** 그리드 행 검사: 길이 같음, legend에 있는 문자만(keep = 추가 허용 문자) */
export function gridIssues(g: { rows: string[]; legend: Record<string, string> }, keep = ''): { path: (string | number)[]; message: string }[] {
  const out: { path: (string | number)[]; message: string }[] = [];
  const w = g.rows[0]?.length ?? 0;
  g.rows.forEach((row, y) => {
    if (row.length !== w) out.push({ path: ['rows', y], message: '모든 행의 길이가 같아야 합니다' });
    for (const ch of row) if (ch !== '.' && !keep.includes(ch) && !(ch in g.legend)) out.push({ path: ['rows', y], message: `legend에 없는 문자: ${ch}` });
  });
  return out;
}

const addAll = (ctx: z.RefinementCtx, issues: ReturnType<typeof gridIssues>, prefix: (string | number)[] = []) => {
  for (const i of issues) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...prefix, ...i.path], message: i.message });
};

const gridBody = {
  rows: z.array(z.string().min(1).max(64)).min(1).max(64),
  legend: z.record(z.string().length(1), gridLegendValueSchema),
};

/** 그리드 파츠(§7.3 확장): 픽셀을 직접 설계. 외곽선은 그리지 않는다(엔진이 크기 등급 outline 모드로 붙임) */
export const gridShapeSchema = z.object({
  type: z.literal('grid'),
  ...gridBody,
  /** 앵커에 놓일 칸 [열, 행]. 생략하면 가운데 */
  origin: z.tuple([z.number().int(), z.number().int()]).optional(),
});

/** 프레임 모드 그리드: pivot = 발밑 칸 [열, 행](생략하면 불투명 칸의 아래 가운데) */
export const frameGridSchema = z.object({ ...gridBody, pivot: z.tuple([z.number().int(), z.number().int()]).optional() })
  .superRefine((g, ctx) => addAll(ctx, gridIssues(g)));

/** 프레임 patch: base 위 at[열, 행]에 덮는다. "." = base 유지, "~" = 지움 */
export const gridPatchSchema = z.object({ ...gridBody, at: z.tuple([z.number().int(), z.number().int()]) })
  .superRefine((g, ctx) => addAll(ctx, gridIssues(g, '~')));

export const checkGridShape = (g: z.infer<typeof gridShapeSchema>, ctx: z.RefinementCtx, prefix: (string | number)[] = []) => addAll(ctx, gridIssues(g), prefix);

export const partShapeSchema = z.discriminatedUnion('type', [
  lineShapeSchema, rectShapeSchema, ellipseShapeSchema, capsuleShapeSchema, polyShapeSchema,
  // discriminatedUnion은 ZodEffects를 받지 않으므로 mask의 행 검사는 partSchema에서 다시 건다
  maskShapeSchema.innerType(), gridShapeSchema,
]);

export type PartShape = z.infer<typeof partShapeSchema>;
export type MaskShape = z.infer<typeof maskShapeSchema>;
export type GridShape = z.infer<typeof gridShapeSchema>;
export type FrameGrid = z.infer<typeof frameGridSchema>;
export type GridPatch = z.infer<typeof gridPatchSchema>;
