import { ForgeError } from '@pixel-forge/core';
import type { Animation, Pose as PoseDeltas, Rules } from '@pixel-forge/spec';
import { lerpPose, mergePose, snapPose } from './pose.js';

export interface TimelineFrame {
  pose: PoseDeltas;
  ms: number;
  /** 마지막 프레임 유지(ms는 defaultKeyMs로 기록) */
  hold: boolean;
  keyName: string;
  inbetween: boolean;
  fx?: string;
}

type AnimRules = Rules['anim'];
type Overrides = Readonly<Record<string, { pose: PoseDeltas }>>;

const ease = (kind: 'in' | 'out', u: number): number => (kind === 'in' ? u * u : 1 - (1 - u) * (1 - u));

/** rule: anim.pose-to-pose — 균등 보간·개수 초과·긴 타격 키는 거부 */
function validate(a: Animation, rules: AnimRules, isStrikeFx: (fx: string) => boolean): void {
  const last = a.keys.length - 1;
  for (const b of a.inbetween) {
    if (b.ease === 'linear') throw new ForgeError('anim.even-inbetween', `${a.id}: 키 사이 균등 보간은 쓰지 않습니다(ease in/out만)`, { inbetween: b });
    const at = a.keys.findIndex((k) => k.name === (b.after ?? b.before));
    if (at < 0 || (b.after !== undefined) === (b.before !== undefined)) {
      throw new ForgeError('anim.inbetween-key', `${a.id}: inbetween은 있는 키 하나를 after 또는 before로 가리켜야 합니다`, { inbetween: b });
    }
    // 비루프 애니의 처음 앞·마지막 뒤는 이웃 키가 없어 같은 포즈가 중복된다
    if (!a.loop && ((b.before !== undefined && at === 0) || (b.after !== undefined && at === last))) {
      throw new ForgeError('anim.inbetween-edge', `${a.id}: 루프가 아닌 애니의 첫 키 앞·마지막 키 뒤에는 사이 프레임을 둘 수 없습니다`, { inbetween: b });
    }
    if (b.count > rules.maxInbetweenPerKey) throw new ForgeError('anim.inbetween-count', `${a.id}: inbetween ${b.count}개 > ${rules.maxInbetweenPerKey}`, { inbetween: b });
  }
  const strikes = a.keys.filter((k) => k.fx !== undefined && isStrikeFx(k.fx));
  for (const k of strikes) {
    if (k.ms === 'hold' || k.ms > rules.strikeMaxMs) throw new ForgeError('anim.strike-too-long', `${a.id}.${k.name}: 타격 키는 ${rules.strikeMaxMs}ms 이하`);
  }
  const [lo, hi] = rules.attackKeyCount;
  if (strikes.length && (a.keys.length < lo || a.keys.length > hi)) {
    throw new ForgeError('anim.attack-keys', `${a.id}: 공격 애니 키는 ${lo}~${hi}개 (${a.keys.length}개)`);
  }
}

/**
 * keys + inbetween → 프레임 목록. 사이 프레임은 지정 키의 바로 앞(before) 또는 뒤(after)에만,
 * 이웃 키 쪽으로 ease 곡선 위치에 놓는다. 루프 애니의 마지막 키 뒤 이웃은 첫 키.
 * isStrikeFx: 타격(베기) fx인지 — 이름이 아니라 fx 정의 종류로 판단하도록 호출자가 준다.
 */
export function buildTimeline(a: Animation, rules: AnimRules, overrides: Overrides = {}, isStrikeFx: (fx: string) => boolean = () => true): TimelineFrame[] {
  validate(a, rules, isStrikeFx);
  const poses = a.keys.map((k) => snapPose(mergePose(k.pose, overrides[k.name]?.pose)));
  const neighbor = (i: number, dir: 1 | -1): number => {
    const j = i + dir;
    if (j >= 0 && j < a.keys.length) return j;
    return a.loop ? (j + a.keys.length) % a.keys.length : i;
  };
  const between = (i: number, dir: 1 | -1, count: number, kind: 'in' | 'out'): TimelineFrame[] => {
    const from = poses[i] ?? {}, to = poses[neighbor(i, dir)] ?? {};
    const out: TimelineFrame[] = [];
    for (let j = 1; j <= count; j++) {
      out.push({ pose: lerpPose(from, to, ease(kind, j / (count + 1))), ms: rules.inbetweenMs, hold: false, keyName: a.keys[i]?.name ?? '', inbetween: true });
    }
    return dir === -1 ? out.reverse() : out;
  };
  const frames: TimelineFrame[] = [];
  a.keys.forEach((k, i) => {
    for (const b of a.inbetween) if (b.before === k.name) frames.push(...between(i, -1, b.count, b.ease === 'in' ? 'in' : 'out'));
    const hold = k.ms === 'hold';
    frames.push({ pose: poses[i] ?? {}, ms: hold ? rules.defaultKeyMs : (k.ms as number), hold, keyName: k.name, inbetween: false, ...(k.fx ? { fx: k.fx } : {}) });
    for (const b of a.inbetween) if (b.after === k.name) frames.push(...between(i, 1, b.count, b.ease === 'in' ? 'in' : 'out'));
  });
  return frames;
}
