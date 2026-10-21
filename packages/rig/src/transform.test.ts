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
