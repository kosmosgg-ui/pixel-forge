import { describe, expect, it } from 'vitest';
import { rigSchema } from '@pixel-forge/spec';
import { boneOrder, solveRig } from './transform.js';
import rigJson from '../../../data/rigs/humanoid-side-v1.rig.json' with { type: 'json' };

const rig = rigSchema.parse(rigJson);

describe('solveRig', () => {
  it('부모가 자식보다 먼저 온다', () => {
    const order = boneOrder(rig);
    for (const [i, n] of order.entries()) {
      const p = rig.bones[n]?.parent;
      if (p) expect(order.indexOf(p)).toBeLessThan(i);
    }
  });

  it('rest pose: 머리는 골반 위, 발은 아래, 위치는 정수', () => {
    const w = solveRig(rig);
    expect(w.root).toMatchObject({ x: 0, y: 0, angle: -90 });
    expect(w.head?.y).toBeLessThan(0);
    expect(w.footF?.y).toBeGreaterThan(0);
    for (const b of Object.values(w)) expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
  });

  it('앞다리는 앞(+x), 뒷다리는 뒤(−x)에서 시작', () => {
    const w = solveRig(rig);
    expect(w.thighF?.x).toBe(1);
    expect(w.thighB?.x).toBe(-1);
  });

  it('축척 2배면 관절 거리도 2배', () => {
    const a = solveRig(rig), b = solveRig(rig, 2);
    expect(b.footF?.y).toBe((a.footF?.y ?? 0) * 2);
  });

  it('포즈 회전은 자식에 전달된다', () => {
    const a = solveRig(rig), b = solveRig(rig, 1, { upperArmF: { rot: -90 } });
    expect(b.handF?.x).not.toBe(a.handF?.x);
    expect(b.head).toEqual(a.head);
  });
});

import rig34Json from '../../../data/rigs/humanoid-34-v1.rig.json' with { type: 'json' };

describe('humanoid-34-v1 restPose (전투 대기 자세)', () => {
  const r34 = rigSchema.parse(rig34Json);
  const w = solveRig(r34);

  it('앞다리 앞·뒷다리 뒤, 발 간격 4~6px', () => {
    const gap = (w.footF?.x ?? 0) - (w.footB?.x ?? 0);
    expect(gap).toBeGreaterThanOrEqual(4);
    expect(gap).toBeLessThanOrEqual(6);
  });

  it('무릎이 굽어 있다(허벅지와 정강이 각도가 다르다)', () => {
    expect(w.shinF?.angle).not.toBe(w.thighF?.angle);
    expect(w.shinB?.angle).not.toBe(w.thighB?.angle);
  });

  it('무기 손은 몸통(가슴 폭 절반) 밖, 양 어깨는 서로 다른 x', () => {
    expect(w.handF?.x).toBeGreaterThan((r34.metrics.chestWidth ?? 0) / 2);
    expect(w.upperArmF?.x).not.toBe(w.upperArmB?.x);
  });

  it('포즈는 restPose 위에 더해진다', () => {
    const b = solveRig(r34, 1, { thighF: { rot: 15 } });
    expect(b.thighF?.angle).toBe(90);
  });
});
