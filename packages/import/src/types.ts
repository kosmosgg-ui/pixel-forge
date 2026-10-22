/** 외부 입력 이미지(트루컬러 RGBA). import는 양자화 전까지만 RGBA를 다룬다 — 그 뒤는 IndexedRaster */
export interface RgbaImage {
  w: number;
  h: number;
  rgba: Uint8Array;
}

/** 분리한 스프라이트 1개(원본 좌표계) */
export interface Sprite {
  /** 원본에서의 bbox */
  x: number;
  y: number;
  w: number;
  h: number;
  /** bbox로 자른 RGBA(이 스프라이트 성분 픽셀만, 이웃 스프라이트 침범 픽셀은 투명) */
  img: RgbaImage;
  /** 이미지 가장자리에 닿음(import.clipped) */
  clipped: boolean;
  /** 잘림이면 닿은 변(top·bottom·left·right) */
  edges?: string[];
}

export interface ImportWarning {
  id: string;
  note: string;
  frames?: number[];
}
