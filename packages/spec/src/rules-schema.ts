import { z } from 'zod';
import { outlineModeSchema } from './bible-schema.js';
import { materialContrastSchema, rampRulesSchema } from './color-schemas.js';

export const shadeRulesSchema = z
  .object({
    id: z.string().min(1),
    thresholds: z.array(z.number().min(0).max(1)).min(1).refine((t) => t.every((v, i) => i === 0 || v > (t[i - 1] ?? 0)), '오름차순이어야 합니다'),
    backLimbDarken: z.number().int().min(0),
  })
  .passthrough();

export const qaRulesSchema = z
  .object({
    id: z.string().min(1),
    sheetScale: z.number().int().min(1),
    orphanMax: z.number().int().min(0),
    bandingMax: z.number().int().min(0),
    silhouetteIoUMax: z.number().min(0).max(1),
    contrastMinL: z.number().min(0).max(1),
    scaleTolerance: z.number().min(0),
    flickerMax: z.number().int().min(0),
    faceCoverMax: z.number().min(0).max(1),
    signatureMin: z.number().min(0).max(1),
    detailMinPx: z.number().int().min(1),
    detailMaxCount: z.number().int().min(0),
    roleColorMin: z.number().min(0).max(1),
    heldVisibleMin: z.number().min(0).max(1),
  })
  .passthrough();

export const rulesSchema = z
  .object({
    version: z.number().int(),
    ramp: rampRulesSchema,
    materialContrast: materialContrastSchema,
    shade: shadeRulesSchema,
    cleanup: z.object({ id: z.string(), minCluster: z.number().int().min(1), removeOrphans: z.boolean(), pixelPerfectLines: z.boolean() }).passthrough(),
    outline: z.object({ id: z.string(), mode: outlineModeSchema, seloutLitThreshold: z.number().min(0).max(1), innerLines: z.boolean() }).passthrough(),
    budgetFit: z.object({ id: z.string(), smallPartArea: z.number().int().min(0) }).passthrough(),
    face: z.object({ id: z.string(), farEyeGap: z.number().int().min(0) }).passthrough(),
    heldThinShade: z.object({ id: z.string(), maxThickness: z.number().int().min(1), brightSteps: z.number().int().min(1) }).passthrough(),
    held: z.object({ id: z.string(), minWidth: z.number().int().min(1) }).passthrough(),
    qa: qaRulesSchema,
    anim: z
      .object({
        id: z.string().min(1),
        defaultKeyMs: z.number().int().positive(),
        strikeMaxMs: z.number().int().positive(),
        maxInbetweenPerKey: z.number().int().min(0),
        attackKeyCount: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
        inbetweenMs: z.number().int().positive(),
      })
      .passthrough(),
  })
  .passthrough();

export type Rules = z.infer<typeof rulesSchema>;
export type ShadeRules = z.infer<typeof shadeRulesSchema>;
export type QaRules = z.infer<typeof qaRulesSchema>;
