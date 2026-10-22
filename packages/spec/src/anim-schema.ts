import { z } from 'zod';

const boneDeltaSchema = z.object({ rot: z.number().optional(), dx: z.number().optional(), dy: z.number().optional() });
/** 뼈 이름 → restPose 위에 더할 변화량 */
export const poseSchema = z.record(z.string().min(1), boneDeltaSchema);

/** fx 정의: 이름으로 키에서 참조한다. color는 bible.fxColors 순번 */
export const fxDefSchema = z.discriminatedUnion('type', [
  /** 실루엣 전체를 fx 색 하나로 치환(피격 플래시) */
  z.object({ type: z.literal('flash'), color: z.number().int().min(0) }),
  /** bone 관절을 중심으로 한 1px 호(베기 궤적) */
  z.object({
    type: z.literal('arc'), bone: z.string().min(1), radius: z.number().positive(),
    fromDeg: z.number(), toDeg: z.number(), color: z.number().int().min(0),
  }),
  /** bone 관절에서 dirDeg 방향으로 length px 직선(화살 궤적) */
  z.object({
    type: z.literal('line'), bone: z.string().min(1), length: z.number().positive(), dirDeg: z.number().default(0),
    from: z.number().min(0).default(0), color: z.number().int().min(0),
  }),
]);

export const animKeySchema = z.object({
  name: z.string().min(1),
  /** "hold" = 마지막 프레임 유지 */
  ms: z.union([z.number().int().positive(), z.literal('hold')]),
  pose: poseSchema.default({}),
  fx: z.string().min(1).optional(),
});

export const inbetweenSchema = z.object({
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
  count: z.number().int().min(1),
  /** linear(균등 보간)는 스키마는 받되 타임라인이 거부한다 (rule: anim.pose-to-pose) */
  ease: z.enum(['in', 'out', 'linear']),
});

export const animationSchema = z.object({
  id: z.string().min(1),
  loop: z.boolean(),
  keys: z.array(animKeySchema).min(1),
  inbetween: z.array(inbetweenSchema).default([]),
});

export const animsFileSchema = z
  .object({
    rig: z.string().min(1),
    fx: z.record(z.string().min(1), fxDefSchema).default({}),
    anims: z.record(z.string().min(1), animationSchema),
  })
  .passthrough()
  .superRefine((f, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    for (const [id, a] of Object.entries(f.anims)) {
      if (a.id !== id) issue(['anims', id, 'id'], `키 이름과 id가 다릅니다: ${a.id}`);
      const names = new Set(a.keys.map((k) => k.name));
      if (names.size !== a.keys.length) issue(['anims', id, 'keys'], '키 이름이 겹칩니다');
      a.keys.forEach((k, i) => { if (k.fx !== undefined && !(k.fx in f.fx)) issue(['anims', id, 'keys', i, 'fx'], `없는 fx: ${k.fx}`); });
      a.inbetween.forEach((b, i) => {
        const ref = b.after ?? b.before;
        if ((b.after === undefined) === (b.before === undefined)) issue(['anims', id, 'inbetween', i], 'after와 before 중 정확히 하나');
        else if (ref !== undefined && !names.has(ref)) issue(['anims', id, 'inbetween', i], `없는 키: ${ref}`);
      });
    }
  });

/** 엔진이 실행할 절차 애니 힌트. 툴은 값만 기록한다 */
export const motionSchema = z.object({
  bob: z.object({ px: z.number().int().min(0), ms: z.number().int().positive() }),
  squash: z.object({ x: z.number().positive(), y: z.number().positive(), ms: z.number().int().positive() }),
  hitFlash: z.object({ ms: z.number().int().positive() }),
});

export const motionOverrideSchema = z.object({
  bob: motionSchema.shape.bob.partial().optional(),
  squash: motionSchema.shape.squash.partial().optional(),
  hitFlash: motionSchema.shape.hitFlash.partial().optional(),
});

export type Pose = z.infer<typeof poseSchema>;
export type FxDef = z.infer<typeof fxDefSchema>;
export type AnimKey = z.infer<typeof animKeySchema>;
export type Animation = z.infer<typeof animationSchema>;
export type AnimsFile = z.infer<typeof animsFileSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type MotionOverride = z.infer<typeof motionOverrideSchema>;

/** 바이블 기본값 위에 Spec 값을 키 단위로 덮어쓴다 */
export function resolveMotion(base: Motion, over: MotionOverride = {}): Motion {
  return {
    bob: { ...base.bob, ...over.bob },
    squash: { ...base.squash, ...over.squash },
    hitFlash: { ...base.hitFlash, ...over.hitFlash },
  };
}
