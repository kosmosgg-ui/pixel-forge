import { z } from 'zod';

/**
 * 프로젝트 export 타깃(data/projects/<id>/target.json) — 게임마다 다른 이름·위치·출처 기본값은 여기에만(툴 코드에 넣지 않는다).
 * godot-rowsheet: 행 = 방향, 열 = 애니 프레임 연속.
 */
export const projectTargetSchema = z.object({
  adapter: z.literal('godot-rowsheet'),
  /** 기본 출력: `@<이름>`(.forge/targets.local.json) 또는 작업 폴더 안 경로 */
  out: z.string().min(1),
  /** 출력 폴더 안 하위 경로 — 후보 폴더(본 에셋 폴더 덮어쓰기 금지). <assetId>/가 붙는다 */
  dir: z.string().min(1),
  /** manifest version 값 */
  version: z.string().min(1),
  /** 시트 행 순서: 행 이름(manifest rows) ↔ import 방향 */
  rows: z.array(z.object({ name: z.string().min(1), dir: z.string().min(1) })).min(1),
  /** 게임 방향 → 행 이름 + 좌우 반전(행이 없으면 manifest에서 뺀다) */
  directions: z.record(z.string().min(1), z.object({ row: z.string().min(1), flip_h: z.boolean().default(false) })),
  /** provenance 기본값(에셋마다 같은 것). assetId·sourceFile·exportFile·aiUsed·rightsReviewed·promptRecord는 forge가 채운다 */
  provenance: z.object({ creator: z.string(), sourceUrl: z.string().default(''), license: z.string(), editedBy: z.string(), creditText: z.string().default('') }),
  notes: z.array(z.string()).default([]),
});

export type ProjectTarget = z.infer<typeof projectTargetSchema>;
