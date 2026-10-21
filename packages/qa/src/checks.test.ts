import { describe, expect, it } from 'vitest';
import { alphaBinary, boundsCanvas, colorBudget, paletteConformance } from './checks/integrity.js';
import { cleanupBanding, cleanupOrphans } from './checks/cleanup.js';
import { formDetailMin, formFaceClear, readContrast, readRoleColor } from './checks/readability.js';
import { animFlicker, baselineStable } from './checks/anim.js';
import { crossChecks, silhouetteIoU, type Silhouette } from './checks/cross.js';
import { runChecks } from './run.js';
import { CLEAN, ctx, frame, palette } from './test-fixture.js';

describe('규칙을 어긴 래스터마다 해당 검사가 실패한다', () => {
  it('깨끗한 래스터는 모두 통과', () => {
    const r = runChecks([frame(CLEAN)], ctx({ roleIndices: new Set([2]) }));
    expect(r.checks.filter((c) => !c.pass).map((c) => c.id)).toEqual([]);
    expect([r.pass, r.score]).toEqual([true, 1]);
  });

  it('팔레트 밖 인덱스 → palette.conformance', () => {
    expect(paletteConformance([frame(['......', '.2z22.', '......'])], ctx()).pass).toBe(false);
  });

  it('반투명 팔레트 색 → alpha.binary', () => {
    const base = palette();
    // addColor는 반투명을 거부하므로 팔레트를 직접 늘린다
    const p = { colors: Uint32Array.from([...base.colors, 0x80808080 >>> 0]), names: [...base.names, 'semi'] };
    expect(alphaBinary([frame(['...', '.5.', '...'])], ctx({ palette: p })).pass).toBe(false);
  });

  it('예산 초과 → color.budget', () => {
    const c = colorBudget([frame(['......', '.1234.', '......'])], ctx({ budget: 3 }));
    expect([c.pass, c.value]).toEqual([false, 4]);
  });

  it('가장자리에 닿음 → bounds.canvas', () => {
    expect(boundsCanvas([frame(['2222..', '.2222.', '......'])]).pass).toBe(false);
  });

  it('고립 픽셀 3개 → cleanup.orphans (mark 위치는 제외)', () => {
    const rows = ['........', '.3.3.3..', '........'];
    expect(cleanupOrphans([frame(rows)], ctx()).pass).toBe(false);
    const mark = new Uint8Array(24); mark[9] = 1;
    expect(cleanupOrphans([frame(rows, { mark })], ctx()).pass).toBe(true);
  });

  it('(A) 선·눈(mark)이 이웃을 덮어 생긴 고립은 세지 않는다', () => {
    const rows = ['.....', '.343.', '.....'];
    const mark = new Uint8Array(15); mark[6] = 1; mark[8] = 1;
    expect(cleanupOrphans([frame(rows, { mark })], ctx()).value).toBe(0);
    expect(cleanupOrphans([frame(rows)], ctx()).value).toBe(3);
  });

  it('1px 단계 띠가 2px 이상 이어진 구간이 여럿 → cleanup.banding, 외딴 1px은 세지 않음', () => {
    const block = ['.123.123.123.123.', '.123.123.123.123.'];
    const c = cleanupBanding([frame(['.................', ...block, '.................'])], ctx());
    expect([c.pass, c.value]).toEqual([false, 4]);
    expect(cleanupBanding([frame(['.....', '.123.', '.....'])], ctx()).value).toBe(0);
  });

  it('배경과 명도가 비슷 → read.contrast', () => {
    expect(readContrast([frame(CLEAN)], ctx({ background: [0xa0, 0x30, 0x30] })).pass).toBe(false);
  });

  it('역할색 비율 미달 → read.role-color', () => {
    expect(readRoleColor([frame(CLEAN)], ctx({ roleIndices: new Set([4]) })).pass).toBe(false);
  });

  it('머리가 많이 가려짐 → form.face-clear', () => {
    expect(formFaceClear([frame(CLEAN, { face: { area: 40, covered: 10 } })], ctx()).pass).toBe(false);
    expect(formFaceClear([frame(CLEAN, { face: { area: 40, covered: 4 } })], ctx()).pass).toBe(true);
  });

  it('1px 대각선 획은 8-연결로 한 조각', () => {
    const rows = ['2....', '.2...', '..2..', '...2.'];
    const material = Uint8Array.from(rows.join('').split('').map((ch) => (ch === '.' ? 0 : 1)));
    expect(formDetailMin([frame(rows, { material })], ctx()).value).toBe(0);
  });

  it('3px 미만 재질 조각 3개 → form.detail-min', () => {
    const rows = ['.........', '.2.2.2.2.', '.........'];
    const material = Uint8Array.from(rows.join('').split('').map((ch) => (ch === '.' ? 0 : 1)));
    expect(formDetailMin([frame(rows, { material })], ctx()).pass).toBe(false);
  });

  it('발밑이 흔들림 → baseline.stable', () => {
    expect(baselineStable([frame(CLEAN), frame(['......', '.2222.', '.2222.', '.2222.', '......', '......'])]).pass).toBe(false);
    expect(baselineStable([frame(CLEAN)]).pass).toBe(true);
  });

  it('정지한 파츠의 색이 바뀜 → anim.flicker', () => {
    const part = new Uint16Array(36).fill(1);
    const a = frame(CLEAN, { part }), b = frame(['......', '.2232.', '.2222.', '.2222.', '.2222.', '......'], { part, stillParts: new Set([1]) });
    expect(animFlicker([a, b], ctx()).pass).toBe(false);
    expect(animFlicker([a, { ...b, stillParts: new Set() }], ctx()).pass).toBe(true);
  });

  it('필수 검사 실패면 점수와 무관하게 불합격', () => {
    const r = runChecks([frame(['2.....', '......'])], ctx());
    expect(r.pass).toBe(false);
    expect(r.sheet.legend).toContain('bounds.canvas');
  });
});

describe('교차 검사', () => {
  const sil = (id: string, rows: string[], sizeClass = 'c'): Silhouette => ({
    id, sizeClass, w: rows[0]!.length, h: rows.length, mask: Uint8Array.from(rows.join('').split('').map((ch) => (ch === '#' ? 1 : 0))),
  });
  const box = ['....', '.##.', '.##.', '.##.'];

  it('발밑 가운데를 맞춰 IoU: 같은 모양은 1, 위치만 다른 것도 1', () => {
    expect(silhouetteIoU(sil('a', box), sil('b', ['##..', '##..', '##..', '....']))).toBe(1);
  });

  it('같은 실루엣 → form.silhouette 실패, 키 차이 큼 → scale.consistency 실패', () => {
    const tall = ['.#..', '.#..', '.#..', '.#..', '.#..', '.#..', '.#..', '.#..'];
    const m = crossChecks([sil('a', box), sil('b', box), sil('c', tall)], 0.8, 0.15);
    expect(m.get('a')?.find((c) => c.id === 'form.silhouette')?.pass).toBe(false);
    expect(m.get('c')?.find((c) => c.id === 'scale.consistency')?.pass).toBe(false);
    expect(m.get('a')?.find((c) => c.id === 'scale.consistency')?.pass).toBe(true);
  });
});
