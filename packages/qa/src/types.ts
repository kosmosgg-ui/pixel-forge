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
  /** 머리 뼈 파츠 면적과 그중 다른 파츠에 가려진 픽셀 수 */
  face?: { area: number; covered: number } | null;
  /** root가 고정된 키 프레임(발밑 기준선 검사 대상) */
  rootFixed?: boolean;
  /** 앞 프레임과 변환이 같은 파츠 id (깜빡임 검사 대상) */
  stillParts?: ReadonlySet<number>;
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
}

export const check = (id: string, required: boolean, pass: boolean, value: number | null, threshold: number | null, extra: Partial<Check> = {}): Check =>
  ({ id, required, pass, value, threshold, ...extra });
