import { z } from 'zod';
import { motionSchema } from './anim-schema.js';
import { hexColorSchema, materialSchema } from './color-schemas.js';

const sizePx = z.tuple([z.number().int().min(1), z.number().int().min(1)]);
export const outlineModeSchema = z.enum(['selout', 'dark', 'none']);

/** 크기 등급별 설정: 외곽선 모드(작은 캔버스는 dark 단색 외곽선이 읽기 쉽다), 그 등급 Spec의 기본 리그 */
export const sizeClassOptionSchema = z.object({
  outline: outlineModeSchema.optional(), rig: z.string().min(1).optional(),
  /** 셀 안 발 앵커 [x, y](import 정렬·게임 계약) — 없으면 가로 가운데·바닥 */
  anchor: z.tuple([z.number().int(), z.number().int()]).optional(),
  /** 이 등급의 논리 키(px, import targetHeight 기본값) */
  height: z.number().int().positive().optional(),
});

/**
 * sizeClasses 항목은 [w, h] 또는 { size: [w, h], outline?, rig?, anchor?, height? }. 파싱 후에는 sizeClasses = [w, h]만,
 * 설정은 sizeClassOptions로 옮겨 기존 코드가 크기만 읽게 한다.
 */
function splitSizeClasses(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('sizeClasses' in raw)) return raw;
  const sc = raw.sizeClasses;
  if (typeof sc !== 'object' || sc === null) return raw;
  const sizes: Record<string, unknown> = {}, options: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sc)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && 'size' in v) {
      const { size, ...rest } = v;
      sizes[k] = size;
      options[k] = rest;
    } else sizes[k] = v;
  }
  return { ...raw, sizeClasses: sizes, sizeClassOptions: options };
}

export const bibleSchema = z.preprocess(splitSizeClasses, z
  .object({
    id: z.string().min(1),
    internalResolution: sizePx.optional(),
    /** 프리렌더: 월드 1단위당 px(모든 모델 공통 — 모델 간 실제 키 차이 보존). 없으면 Spec height로 맞춤 */
    pixelsPerUnit: z.number().positive().optional(),
    view: z.enum(['side', 'topdown', 'iso']),
    directions: z.union([z.literal(1), z.literal(4), z.literal(8)]),
    sizeClasses: z.record(z.string().min(1), sizePx),
    sizeClassOptions: z.record(z.string().min(1), sizeClassOptionSchema).default({}),
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
    /** 생물(캐릭터·적)의 기본 모드(사용자 승인 P7 마감) — import(외부 AI 도트) · prerender(3D 모델) · atoms/frames · shapes */
    defaultCreatureMode: z.enum(['import', 'prerender', 'atoms', 'frames', 'shapes']).default('atoms'),
    /** 엔진용 절차 애니 힌트 기본값 (manifest motion) */
    motion: motionSchema.default({ bob: { px: 1, ms: 400 }, squash: { x: 1.1, y: 0.9, ms: 80 }, hitFlash: { ms: 60 } }),
    /** forge apply 기본값(게임 프로젝트 폴더, 작업 폴더 기준 상대 경로) */
    apply: z.object({ target: z.string().min(1).default('dir'), out: z.string().min(1).optional() }).optional(),
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
  }));

export type Bible = z.infer<typeof bibleSchema>;
