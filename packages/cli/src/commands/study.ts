/** pxl study 수치(P10 2.4 — qa.study): 외톨이 픽셀 %, 밴딩(1000px당), 붙은 색 단계 쌍, 튀는 색 수, 안티앨리어싱 % */
export interface StudyNumbers { lonePct: number | null; bandingPer1000: number | null; closeSteps: number; eyeburn: number; aaPct: number | null; colors: number | null }

/** 목표(제안값, 사용자 승인 전 경고만): 외톨이 15% 이하, 밴딩 30 이하 */
export const STUDY_TARGET = { lonePct: 15, bandingPer1000: 30 } as const;

const num = (re: RegExp, text: string): number | null => { const m = re.exec(text); return m?.[1] !== undefined ? Number(m[1]) : null; };

/** study 텍스트 → 수치(문장 형식이 바뀌면 null — 지어내지 않는다) */
export function parseStudy(text: string): StudyNumbers {
  const tight = /Steps too close: ([^\n]*)/.exec(text)?.[1] ?? '';
  const more = tight.includes(' ...') ? 1 : 0;
  const burn = /Eyeburn: ([^\n]*?): far more saturated/.exec(text)?.[1] ?? '';
  return {
    lonePct: num(/(\d+(?:\.\d+)?)% of the pixels stand alone/, text),
    bandingPer1000: num(/([\d.]+) per 1000 px/, text),
    closeSteps: (tight.match(/ to #/g) ?? []).length + more,
    eyeburn: burn ? (burn.match(/\(chroma/g) ?? []).length : 0,
    aaPct: num(/in-between tones on the steps of edges on (\d+(?:\.\d+)?)% of the pixels/, text),
    colors: num(/as drawn, (\d+) colors/, text),
  };
}

/** 목표 대비 경고(제안값 — 실패 아님) */
export function studyWarnings(s: StudyNumbers): string[] {
  return [
    ...(s.lonePct !== null && s.lonePct > STUDY_TARGET.lonePct ? [`외톨이 픽셀 ${s.lonePct}% > ${STUDY_TARGET.lonePct}%`] : []),
    ...(s.bandingPer1000 !== null && s.bandingPer1000 > STUDY_TARGET.bandingPer1000 ? [`밴딩 ${s.bandingPer1000}/1000px > ${STUDY_TARGET.bandingPer1000}`] : []),
  ];
}
