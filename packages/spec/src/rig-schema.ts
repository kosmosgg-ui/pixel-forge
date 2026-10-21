import { z } from 'zod';

export const depthLayerSchema = z.enum(['back', 'mid', 'front']);

export const boneSchema = z.object({
  parent: z.string().min(1).nullable(),
  /** 부모 뼈 로컬 좌표에서 이 뼈 관절 위치(px, baseHeight 기준) */
  pivot: z.tuple([z.number(), z.number()]),
  length: z.number().min(0),
  /** 부모 대비 각도(도). 0 = 부모 +x, 양수 = 화면 시계 방향 */
  restAngle: z.number(),
  depthLayer: depthLayerSchema,
});

export const rigSchema = z
  .object({
    id: z.string().min(1),
    view: z.enum(['side', 'topdown', 'iso']),
    facing: z.enum(['right', 'left']),
    /** pivot·length가 맞춰진 캐릭터 키(px) */
    baseHeight: z.number().positive(),
    bones: z.record(z.string().min(1), boneSchema),
    drawOrder: z.array(z.string().min(1)),
  })
  .passthrough()
  .superRefine((r, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const names = Object.keys(r.bones);
    const roots = names.filter((n) => r.bones[n]?.parent === null);
    if (roots.length !== 1) issue(['bones'], `루트 뼈는 정확히 1개여야 합니다 (${roots.length}개)`);
    for (const n of names) {
      const p = r.bones[n]?.parent;
      if (p !== null && p !== undefined && !(p in r.bones)) issue(['bones', n, 'parent'], `없는 부모 뼈: ${p}`);
      const seen = new Set<string>();
      for (let cur: string | null | undefined = n; cur; cur = r.bones[cur]?.parent) {
        if (seen.has(cur)) { issue(['bones', n], '뼈 계층에 순환이 있습니다'); break; }
        seen.add(cur);
      }
    }
    const order = [...r.drawOrder].sort().join(',');
    if (order !== [...names].sort().join(',') || new Set(r.drawOrder).size !== r.drawOrder.length) {
      issue(['drawOrder'], 'drawOrder는 모든 뼈를 정확히 한 번씩 포함해야 합니다');
    }
  });

export type Rig = z.infer<typeof rigSchema>;
export type Bone = z.infer<typeof boneSchema>;
export type DepthLayer = z.infer<typeof depthLayerSchema>;
