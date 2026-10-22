import { describe, expect, it } from 'vitest';
import { footContactCheck, headBobCheck, topVisibilityCheck, weaponSeparationCheck } from './anim-checks.js';

describe('가독성 QA(P10 1절)', () => {
  /** 12×16 프레임: 몸 기둥(색 2) + 두 발(아래 3줄) — top = 머리 꼭대기 y, lift = 앞발을 띄우는 px */
  const fr = (top: number, lift = 0, sword = false) => {
    const px = new Uint8Array(12 * 16);
    for (let y = top; y < 13; y++) for (let x = 4; x < 8; x++) px[y * 12 + x] = 2;
    for (let y = 13; y < 16; y++) { px[y * 12 + 1] = 2; px[y * 12 + 2] = 2; }
    for (let y = 13 - lift; y < 16 - lift; y++) { px[y * 12 + 9] = 2; px[y * 12 + 10] = 2; }
    if (sword) for (let y = 6; y < 10; y++) px[y * 12 + 5] = 1;
    return { w: 12, h: 16, px };
  };
  const res = (tops: number[], o: { lift?: number; sword?: boolean } = {}) => ({
    palette: [0xc0c8d0, 0x803020], warnings: [], scale: 1, paletteDelta: 0, frameMap: { walk_e: tops.map((_, i) => i) },
    frames: tops.map((t, i) => ({ anim: 'walk', dir: 'e', index: i, source: { row: 0, sprite: i }, frame: fr(t, i === 0 ? o.lift ?? 0 : 0, o.sword) })),
  });
  it('anim.head-bob: 3px 정상, 4px 경고', () => {
    expect(headBobCheck(res([2, 3, 5, 2, 3, 4]))).toMatchObject({ pass: true, value: 3 });
    expect(headBobCheck(res([1, 3, 5, 2, 3, 4]))).toMatchObject({ pass: false, value: 4 });
  });
  it('anim.foot-contact: 접지 프레임 앞발이 앵커 행(15)에 닿는가', () => {
    expect(footContactCheck(res([2, 2, 2, 2, 2, 2]), 15).pass).toBe(true);
    expect(footContactCheck(res([2, 2, 2, 2, 2, 2], { lift: 2 }), 15)).toMatchObject({ pass: false, value: 2 });
  });
  it('form.weapon-separation: 몸에 둘러싸인 검 > 60% 경고, 무기 색 없으면 null로 생략', () => {
    expect(weaponSeparationCheck(res([2], { sword: true }), 0xc0c8d0)).toMatchObject({ pass: false, value: 1 });
    expect(weaponSeparationCheck(res([2]), 0xc0c8d0)).toMatchObject({ pass: true, value: 0 });
    expect(weaponSeparationCheck(res([2]), null)).toMatchObject({ pass: true, value: null });
  });
  it('view.top-visibility: 정보 — 머리 윗면 행 수', () => {
    expect(topVisibilityCheck(res([2]))).toMatchObject({ id: 'view.top-visibility', pass: true });
  });
});

describe('정리 개선(P10 2.4)', () => {
  it('배경 색조 잔여 → 다른 색, 붙은 단계 병합, 안쪽 외톨이 흡수(경계·가장 어두운 색 보호)', async () => {
    const { cleanupFramesInPlace } = await import('./cleanup.js');
    // 팔레트: 1 어두운 선, 2 빨강, 3 거의 같은 빨강(병합), 4 초록 잔여(배경 #00ff00 색조), 5 밝은 크림(외톨이)
    const palette = [0x101010, 0xc03030, 0xc23232, 0x10d010, 0xe8e0b0];
    const w = 7, px = new Uint8Array(w * 7).fill(2);
    px[3 * w + 3] = 5;           // 안쪽 외톨이 → 2로 흡수
    px[0] = 4;                    // 초록 잔여 → 다른 색
    px[1] = 3;                    // 붙은 단계 → 2로
    px[6 * w + 6] = 1;            // 가장 어두운 색(보호)
    const s = cleanupFramesInPlace([{ w, h: 7, px }], palette, { background: 0x00ff00 });
    expect([px[3 * w + 3], px[0] !== 4, px[1], px[6 * w + 6]]).toEqual([2, true, 2, 1]);
    expect(s).toMatchObject({ despilled: 1, merged: 1, absorbed: 1 });
  });
});
