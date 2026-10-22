import type { IndexedRaster, Palette } from '@pixel-forge/core';
import type { QaRules } from '@pixel-forge/spec';

export interface Check {
  id: string;
  required: boolean;
  pass: boolean;
  value: number | null;
  threshold: number | null;
  /** 문제 위치 [x, y] (frame 번호가 없으면 0번 프레임) */
  where?: [number, number][];
  frame?: number;
  note?: string;
}

export interface Report {
  id: string;
  pass: boolean;
  /** 통과 비율 0~1 */
  score: number;
  checks: Check[];
  /** 렌더 meta.budget 그대로(색 예산 병합 내역) */
  budget?: unknown;
  /** 렌더 경고(아톰 회전을 각도 변형 없이 RotSprite로 처리 등), 전 프레임 합집합 */
  warnings?: string[];
  /** 크기 등급 맞춤 결과 { requested, used, reason } */
  sizeClass?: { requested: string; used: string; reason: string };
  sheet: { path?: string; legend: string };
}

/** QA가 받는 프레임 1장. render를 import하지 않고 렌더 결과에서 필요한 레이어만 받는다 */
export interface QaFrame {
  name: string;
  raster: IndexedRaster;
  /** 픽셀별 재질 id(0 = 없음) */
  material?: Uint8Array;
  /** 픽셀별 파츠 id(0 = 없음) */
  part?: Uint16Array;
  /** 외곽선·내부선·눈 등 정리 대상에서 빠지는 위치 */
  mark?: Uint8Array;
  /** 머리 뼈 파츠 면적·다른 파츠에 가려진 픽셀 수, 머리 위 held 픽셀 수, 눈 둘레 창 크기·얼굴 재질 아닌 픽셀 수 */
  face?: { area: number; covered: number; heldOver?: number; eyeWindow?: number; eyeWindowBad?: number; nearHead?: number } | null;
  /** root가 고정된 키 프레임(발밑 기준선 검사 대상) */
  rootFixed?: boolean;
  /** 앞 프레임과 변환이 같은 파츠 id (깜빡임 검사 대상) */
  stillParts?: ReadonlySet<number>;
  /** 애니 이름(rest 프레임은 'rest')과 키 프레임 여부(사이 프레임은 false) — anim.pose-distinct */
  anim?: string;
  key?: boolean;
  /** 방향(프리렌더)과 눈 픽셀 수 — form.face-visible */
  dir?: string;
  eyes?: number;
}

export interface RampStep {
  ramp: string;
  step: number;
}

export interface QaContext {
  id: string;
  palette: Palette;
  budget: number;
  /** 바이블 배경색 [r, g, b] */
  background: readonly [number, number, number];
  rules: QaRules;
  /** 팔레트 인덱스 → 재질 램프·단계 */
  rampOf: ReadonlyMap<number, RampStep>;
  /** roleColorKey 재질의 인덱스(램프 + 외곽선 톤). 없으면 검사 생략 */
  roleIndices?: ReadonlySet<number>;
  /** 손에 든 파츠(form.held-visible). 없으면 검사 통과 */
  held?: readonly HeldInfo[];
  /** Spec signature 이름과 그 파츠 id들(form.signature). 없으면 검사 통과 */
  signature?: { name: string; parts: ReadonlySet<number> };
  /** Spec mode — frames 모드 death 전체 회전 검사(anim.pose-distinct) */
  mode?: string;
  /** 외곽선 톤·전역 외곽선색 인덱스 — 이 색으로만 칠해진 픽셀은 보이는 것으로 치지 않는다 */
  lineIndices?: ReadonlySet<number>;
}

export interface HeldInfo {
  /** 파츠 id (spec.parts 순번 + 1) */
  part: number;
  name: string;
  /** 손 파츠 id들(부착 뼈의 부모 뼈 파츠) */
  hand: readonly number[];
  /** 같은 뼈 파츠 id들(날밑·손잡이 등) — 손에서 이 파츠들을 거쳐 이어지면 붙어 있는 것 */
  group?: readonly number[];
  /** rest 프레임에서 이 파츠 픽셀 수 */
  restCount: number;
}

/** 프레임별 문제 위치 목록 → 가장 많은 프레임의 개수·위치·순번 (임계값은 프레임 1장 기준) */
export function worstFrame(perFrame: readonly [number, number][][]): { value: number; extra: Partial<Check> } {
  let worst = -1, value = 0;
  perFrame.forEach((w, i) => { if (w.length > value) { value = w.length; worst = i; } });
  const where = perFrame[worst];
  return { value, extra: where && where.length ? { where, frame: worst } : {} };
}

export const check =(id: string, required: boolean, pass: boolean, value: number | null, threshold: number | null, extra: Partial<Check> = {}): Check =>
  ({ id, required, pass, value, threshold, ...extra });
