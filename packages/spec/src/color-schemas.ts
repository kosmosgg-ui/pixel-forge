import { z } from 'zod';

// P1은 팔레트에 필요한 필드만 검증한다. 나머지 필드는 passthrough로 통과시키고 P2에서 전체 스키마로 확장
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 형식이어야 합니다');

export const materialSchema = z.object({
  base: hexColorSchema,
  steps: z.number().int().min(2).max(8),
  kind: z.string().min(1),
  contrast: z.number().positive().optional(),
  /** 이 재질과는 색이 가까워도 되고 같은 hex는 인덱스를 공유한다 */
  shareWith: z.string().min(1).optional(),
});

export const bibleColorsSchema = z
  .object({
    id: z.string().min(1),
    materials: z.record(z.string().min(1), materialSchema).refine((m) => Object.keys(m).length > 0, '재질이 하나 이상 필요합니다'),
    outline: z.object({ globalColor: hexColorSchema }).passthrough(),
    fxColors: z.array(hexColorSchema),
  })
  .passthrough()
  .superRefine((b, ctx) => {
    for (const [id, m] of Object.entries(b.materials)) {
      if (m.shareWith === undefined) continue;
      if (m.shareWith === id || !(m.shareWith in b.materials)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['materials', id, 'shareWith'], message: `없는 재질이거나 자기 자신입니다: ${m.shareWith}` });
      }
    }
  });

export const rampRulesSchema = z
  .object({
    id: z.string().min(1),
    steps: z.number().int().min(2).max(8),
    deltaL: z.number().positive(),
    hueShift: z.number().min(0),
    warmHue: z.number(),
    coolHue: z.number(),
    chromaFalloff: z.number().min(0).max(1),
    minL: z.number().min(0).max(1),
    maxL: z.number().min(0).max(1),
    avoidHueBand: z.tuple([z.number(), z.number()]),
    reservedMinDistance: z.number().min(0),
    collisionNudgeL: z.number().positive(),
    collisionMaxNudges: z.number().int().min(0),
    outlineToneDeltaL: z.number().min(0),
    outlineToneChroma: z.number().min(0).max(1),
  })
  .passthrough()
  .refine((r) => r.minL < r.maxL, 'minL < maxL 이어야 합니다');

// 재질 종류 이름은 게임마다 자유. 숫자 값만 대비 계수로 쓰고 id·source 같은 문자열은 버린다
export const materialContrastSchema = z
  .object({ default: z.number().positive() })
  .passthrough()
  .transform((o) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === 'number') out[k] = v;
    return out as Record<string, number> & { default: number };
  });

export const rulesColorSchema = z
  .object({ ramp: rampRulesSchema, materialContrast: materialContrastSchema })
  .passthrough();

export type Material = z.infer<typeof materialSchema>;
export type BibleColors = z.infer<typeof bibleColorsSchema>;
export type RampRules = z.infer<typeof rampRulesSchema>;
export type MaterialContrast = z.infer<typeof materialContrastSchema>;
export type RulesColor = z.infer<typeof rulesColorSchema>;
