import { z } from 'zod';

/**
 * import 모드(P8): 외부 이미지(GPT 등 AI가 그린 도트풍 시트·애니 일러스트) → 표준 산출물.
 * 생성은 하지 않는다 — 입력 파일만 받는다(사용자 승인 P8 "하지 말 것").
 */
export const importSourceSchema = z.object({
  /** 입력 PNG(data/import/ 아래, 저장소 제외) */
  path: z.string().min(1),
  /** 생성 출처(필수 — 스팀 AI 공개 기록, manifest aiGenerated/aiUsed로 이어진다) */
  origin: z.string().min(1),
  createdAt: z.string().min(1).optional(),
  /** 원본 프롬프트 기록(provenance promptRecord) */
  prompt: z.string().optional(),
});

export const importRowSchema = z.object({
  anim: z.string().min(1),
  /** 방향 이름(s = 정면, n = 뒤, e = 옆(오른쪽) …) */
  dir: z.string().min(1),
  /** 이미지 줄 번호(위에서 0부터, 한 줄에 애니 여러 개일 때). 생략하면 layout 순번 */
  row: z.number().int().min(0).optional(),
  /** 이 줄에서 왼쪽부터 찾은 스프라이트 순번. 생략하면 줄 전체 */
  frames: z.array(z.number().int().min(0)).optional(),
  fps: z.number().positive().optional(),
});

export const importLayoutSchema = z.object({ rows: z.array(importRowSchema).min(1) });

/** 셀(프레임 크기)과 발 앵커. 생략하면 바이블 크기 등급의 size·anchor */
export const importCellSchema = z.object({
  w: z.number().int().min(4),
  h: z.number().int().min(4),
  /** 생략하면 바이블 크기 등급 anchor, 그것도 없으면 feet-center */
  anchor: z.union([z.literal('feet-center'), z.tuple([z.number().int(), z.number().int()])]).optional(),
});

export const importPaletteSchema = z.object({
  /** auto = 입력 색에서 median-cut, bible = 바이블 램프에 최근접(명도 순서 보존) */
  from: z.enum(['auto', 'bible']).default('auto'),
  max: z.number().int().min(2).max(64).default(32),
});

/** import 모드 Spec 필드(spec-schema가 펼쳐 넣는다) */
export const importFields = {
  source: importSourceSchema.optional(),
  layout: importLayoutSchema.optional(),
  cell: importCellSchema.optional(),
  palette: importPaletteSchema.default({}),
  /** 이 값 이상 알파 = 불투명 */
  alphaThreshold: z.number().int().min(1).max(255).default(128),
  /** 같은 줄의 픽셀 완전 동일 프레임을 하나로(원래 순서는 frameMap) */
  dedupe: z.boolean().default(true),
  /** 모든 프레임에 하나의 공통 배율: 가장 큰 프레임 키 → targetHeight(px). 생략하면 원본 크기 */
  targetHeight: z.number().int().min(4).optional(),
  /** auto = 불투명 배경이면 모서리 최빈색 중 가장자리와 이어진 영역만 투명(흰 천 내부 보존), none = 처리 안 함 */
  background: z.enum(['auto', 'none']).default('auto'),
};
