export interface Lab { L: number; a: number; b: number }
/** h는 도(degree), [0, 360) */
export interface Lch { L: number; C: number; h: number }

const GAMUT_EPS = 1e-7;
const GAMUT_ITERATIONS = 20;

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toEncoded = (v: number): number => {
  const s = Math.sign(v);
  const a = Math.abs(v);
  return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055) * 255;
};

export function srgbToOklab(r: number, g: number, b: number): Lab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToLinearRgb({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** 0~255 실수, 범위 밖일 수 있음 */
export function oklabToSrgb(lab: Lab): [number, number, number] {
  const [r, g, b] = oklabToLinearRgb(lab);
  return [toEncoded(r), toEncoded(g), toEncoded(b)];
}

export function oklabToOklch({ L, a, b }: Lab): Lch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function oklchToOklab({ L, C, h }: Lch): Lab {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export function isInSrgbGamut(lab: Lab): boolean {
  return oklabToLinearRgb(lab).every((v) => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS);
}

/**
 * 범위 밖이면 L과 h는 그대로 두고 C만 이분 탐색으로 줄인다.
 * L 자체가 0~1 밖이면 C=0으로도 못 맞추므로 마지막 클램프가 처리한다.
 */
export function oklchToSrgbInGamut(lch: Lch): [number, number, number] {
  let C = lch.C;
  if (!isInSrgbGamut(oklchToOklab(lch))) {
    let lo = 0;
    let hi = lch.C;
    for (let i = 0; i < GAMUT_ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      if (isInSrgbGamut(oklchToOklab({ ...lch, C: mid }))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  const [r, g, b] = oklabToSrgb(oklchToOklab({ ...lch, C }));
  const q = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));
  return [q(r), q(g), q(b)];
}
