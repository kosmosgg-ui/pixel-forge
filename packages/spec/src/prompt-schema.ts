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
  /** 프레임별 표시 시간(ms, 길이 = frames) — 게임 패턴 시간에 맞출 때(G2 U2 오크 대장) */
  ms: z.array(z.number().int().positive()).optional(),
  /** 구간(telegraph·active·recovery) → 프레임 번호 */
  phases: z.record(z.string().min(1), z.array(z.number().int().min(0))).optional(),
  /** 예고 유지 프레임(남은 예고 시간 동안 보여 준다) */
  hold: z.number().int().min(0).optional(),
  /** 크기 보정 기준 프레임(서 있는 프레임 번호 — G2 U1 scaleAnchor). 원본마다 그려진 크기가 다를 때 */
  scaleAnchorFrame: z.number().int().min(0).optional(),
  /** 걷기 한 걸음 길이(1배 px, 게임 3.3b) */
  stride_px: z.number().positive().optional(),
  /** 프레임별 포즈 문장 — 길이 = frames */
  poses: z.array(z.string().min(1)),
  /** 방향별로 덧붙이는 문장 */
  viewExtra: z.record(promptViewSchema, z.string()).default({}),
}).refine((a) => a.poses.length === a.frames, { message: 'poses 수는 frames와 같아야 합니다', path: ['poses'] })
  .refine((a) => !a.ms || a.ms.length === a.frames, { message: 'ms 수는 frames와 같아야 합니다', path: ['ms'] });

export const promptActorSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, '소문자·숫자·_ 만(파일명 <actorId>__<action>_<dir>.png)'),
  bible: z.string().min(1),
  sizeClass: z.string().min(1),
  /** 캐릭터 설명(모든 요청 첫 문단) */
  description: z.string().min(1),
  /** 사용자가 가진 참조 이미지(모든 요청에 첨부) */
  references: z.array(z.string().min(1)).min(1),
  /** 턴어라운드 결과 파일 이름(이후 모든 요청의 두 번째 참조). 생략하면 <id>__turnaround.png */
  turnaroundFile: z.string().regex(/^[a-z][a-z0-9_]*__[a-z0-9_]+\.png$/).optional(),
  /** 크기 기준 이미지(서 있는 대기 1프레임 — G2 U1). 동작 요청에 턴어라운드 다음으로 첨부 */
  sizeRefFile: z.string().regex(/^[a-z][a-z0-9_]*__[a-z0-9_]+\.png$/).optional(),
  /** 디자인 기준에서 반드시 지킬 것(모든 요청 Rules 끝에 붙는다 — 예: 망토) */
  mustKeep: z.array(z.string().min(1)).default([]),
  /** 턴어라운드 요청을 낼지(적은 원화 1장이 기준이라 false — G2 U2) */
  turnaround: z.boolean().default(true),
  /** 동작 시트(한 줄 = 한 동작, G2 U3): 시트 키(actions_side) → 줄 구성 + 크기 기준(시트 하나에 배율 하나) */
  sheets: z.record(z.string().regex(/^[a-z][a-z0-9]*_[a-z]+$/), z.object({
    view: promptViewSchema,
    rows: z.array(z.object({ action: z.string().min(1), frames: z.number().int().min(1) })).min(1),
    anchor: z.object({ row: z.number().int().min(0), frame: z.number().int().min(0), axis: z.enum(['h', 'w']), size: z.number().int().positive() }),
  })).default({}),
  /** 정리에서 지울 색상 범위(HSV 도) — 원화에 없는 배경 계열 잡티 */
  dropHue: z.tuple([z.number(), z.number()]).optional(),
  /** 무기 붉은 기 → 금속(옵션) */
  redToMetal: z.boolean().default(false),
  /** 변환 팔레트 색 수(바이블 colorBudget과 같게 — 적 24) */
  paletteMax: z.number().int().min(2).max(64).optional(),
  /** 초록 옷 캐릭터면 마젠타 배경 */
  altBackground: z.boolean().default(false),
  /** 생산 순서대로: 동작 → 방향들 */
  produce: z.array(z.object({ action: z.string().min(1), views: z.array(promptViewSchema).min(1) })).min(1),
});

/** 필살기 컷인 요청 문구(P10 3절) — 프레임 없는 일러스트 1장, {{character}}·{{style}}·{{background}}·{{rules}} 치환 */
export const promptCutinSchema = z.object({ id: z.literal('cutin'), text: z.string().min(1), style: z.array(z.string()).optional(), rules: z.array(z.string()).optional() });
export type PromptCutin = z.infer<typeof promptCutinSchema>;

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
