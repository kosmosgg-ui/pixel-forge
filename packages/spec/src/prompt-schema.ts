import { z } from 'zod';

/**
 * GPT 이미지 요청 문구 = 데이터(P9-M, data/projects/<id>/prompts/). 조립은 {{이름}} 문자열 치환만.
 * 같은 형식을 나중에 API 생성(P9-API, 보류)이 그대로 쓴다.
 */
export const PROMPT_VIEWS = ['side', 'front', 'back'] as const;
export const promptViewSchema = z.enum(PROMPT_VIEWS);

export const promptBaseSchema = z.object({
  /** 공통 스타일 문장(쉼표로 이어 붙인다) */
  style: z.array(z.string().min(1)).min(1),
  background: z.object({ default: z.string().min(1), alt: z.string().min(1) }),
  rules: z.array(z.string().min(1)).min(1),
  /** 방향 → 시점 문장 */
  views: z.record(promptViewSchema, z.string().min(1)),
  /** 방향 → import 방향 이름(행 매칭: s 정면·n 뒤·e 옆) */
  importDirs: z.record(promptViewSchema, z.string().min(1)),
  /** 동작 요청 문구 틀 */
  template: z.string().min(1),
  /** 턴어라운드(참조용 전신 3면) 문구 틀 */
  turnaround: z.string().min(1),
});

export const promptActionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*$/, '소문자·숫자만(파일명에 쓴다)'),
  /** 사람이 읽는 동작 이름(문구에 들어간다) */
  title: z.string().min(1),
  frames: z.number().int().min(1).max(16),
  fps: z.number().positive(),
  loop: z.boolean(),
  /** 걷기 한 걸음 길이(1배 px, 게임 3.3b) */
  stride_px: z.number().positive().optional(),
  /** 프레임별 포즈 문장 — 길이 = frames */
  poses: z.array(z.string().min(1)),
  /** 방향별로 덧붙이는 문장 */
  viewExtra: z.record(promptViewSchema, z.string()).default({}),
}).refine((a) => a.poses.length === a.frames, { message: 'poses 수는 frames와 같아야 합니다', path: ['poses'] });

export const promptActorSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, '소문자·숫자·_ 만(파일명 <actorId>__<action>_<dir>.png)'),
  bible: z.string().min(1),
  sizeClass: z.string().min(1),
  /** 캐릭터 설명(모든 요청 첫 문단) */
  description: z.string().min(1),
  /** 사용자가 가진 참조 이미지(모든 요청에 첨부) */
  references: z.array(z.string().min(1)).min(1),
  /** 초록 옷 캐릭터면 마젠타 배경 */
  altBackground: z.boolean().default(false),
  /** 생산 순서대로: 동작 → 방향들 */
  produce: z.array(z.object({ action: z.string().min(1), views: z.array(promptViewSchema).min(1) })).min(1),
});

export const FIX_IDS = ['identity', 'legs', 'clipped', 'size', 'background', 'detail', 'text', 'backface'] as const;
export const promptFixesSchema = z.object({
  /** 프레임 수 불일치: 원래 문구 뒤에 붙인다 */
  frameCount: z.string().min(1),
  fixes: z.array(z.object({ id: z.enum(FIX_IDS), title: z.string().min(1), text: z.string().min(1) })).length(FIX_IDS.length),
});

export type PromptBase = z.infer<typeof promptBaseSchema>;
export type PromptAction = z.infer<typeof promptActionSchema>;
export type PromptActor = z.infer<typeof promptActorSchema>;
export type PromptFixes = z.infer<typeof promptFixesSchema>;
export type PromptView = z.infer<typeof promptViewSchema>;
export type FixId = (typeof FIX_IDS)[number];
