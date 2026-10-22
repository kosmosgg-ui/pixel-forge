import { z } from 'zod';

/** forge fx-import 묶음(P10 2.3): pxl 산출 → 게임 이펙트 시트. 셋 중 하나: anim(스트립) · frames(스프라이트 목록, dirs 8이면 방향별) · rows(이름 붙은 스트립 행) */
const fxAssetSchema = z.object({
  anim: z.string().min(1).optional(),
  frames: z.array(z.string().min(1)).min(1).optional(),
  rows: z.record(z.string().min(1), z.string().min(1)).optional(),
  dirs: z.union([z.literal(1), z.literal(8)]).default(1),
  /** 프레임 길이(ms) — 하나면 전 프레임 같은 값. anim·rows는 pxl JSON의 duration */
  ms: z.array(z.number().int().positive()).optional(),
  loop: z.boolean().default(false),
  note: z.string().optional(),
}).refine((a) => [a.anim, a.frames, a.rows].filter((x) => x !== undefined).length === 1, { message: 'anim · frames · rows 중 하나만' });

export const fxAssetsSchema = z.object({
  /** pxl 소스(작업 폴더 기준) */
  source: z.string().min(1),
  assets: z.record(z.string().regex(/^fx_[a-z0-9_]+$/), fxAssetSchema),
});

export type FxAssets = z.infer<typeof fxAssetsSchema>;
export type FxAsset = FxAssets['assets'][string];
