import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headWidth, sourceHeights, type IndexFrame } from '@pixel-forge/import';
import { decodePng } from '../io/png.js';
import type { Imported } from './import.js';

/** 크기 보정 비교에 쓰는 동작 묶음(make-compose의 Part와 같은 모양) */
export interface ScalePart { key: string; im: Imported; anim: string; order: number[] }

const HEAD_TOLERANCE = 0.1;

/** 등록된 크기 기준 이미지(references/size_ref)의 최신본 — superseded 표시는 건너뛴다 */
function sizeRefPng(cwd: string, actorId: string): string | null {
  const dir = join(cwd, 'data', 'import', actorId, 'references', 'size_ref');
  if (!existsSync(dir)) return null;
  const live = readdirSync(dir).filter((f) => f.endsWith('.intake.json')).sort().filter((f) => !(JSON.parse(readFileSync(join(dir, f), 'utf8')) as { superseded?: boolean }).superseded);
  const last = live.at(-1);
  return last ? join(dir, last.replace('.intake.json', '.png')) : null;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * 동작의 '서 있는' 기준 프레임(중복 제거 전 순서): 크기 보정 프레임(scaleAnchorFrame, 시트 scaleAnchor 줄의 frame)이거나
 * idle·walk·run의 첫 프레임. 공격·피격처럼 무기가 머리 위로 올라가는 동작은 머리 폭 비교에서 뺀다(undefined).
 */
const STANDING = ['idle', 'walk', 'run'];
function anchorFrame(p: ScalePart): IndexFrame | undefined {
  const s = p.im.spec, rows = s.layout?.rows ?? [];
  const sheetRow = s.scaleAnchor ? rows[s.scaleAnchor.row] : undefined;
  const k = s.scaleAnchorFrame ?? (sheetRow?.anim === p.anim ? s.scaleAnchor?.frame : STANDING.includes(p.anim) ? 0 : undefined);
  if (k === undefined) return undefined;
  const frames = p.im.result.frames.filter((f) => f.anim === p.anim).sort((a, b) => a.index - b.index);
  const u = p.order[k];
  return u === undefined ? undefined : frames[u]?.frame;
}

/**
 * G2 U1: qa.scaleAnchor(크기 보정한 동작 — 배율, 크기 기준 대비 원본에 그려진 비율) + anim.scale-consistency
 * (기준 프레임 머리 폭이 idle과 ±10% 밖이면 경고).
 */
export function scaleQa(cwd: string, actorId: string, parts: readonly ScalePart[]) {
  const ref = sizeRefPng(cwd, actorId);
  const refH = ref ? sourceHeights(decodePng(readFileSync(ref)), { rows: [{ anim: 'idle', dir: 'e' }], alphaThreshold: 128, background: 'auto' })[0]?.[0] : undefined;
  const scaleAnchor = parts.filter((p) => p.im.spec.scaleAnchorFrame !== undefined).map((p) => {
    const s = p.im.spec, frame = s.scaleAnchorFrame ?? 0;
    const h = sourceHeights(decodePng(readFileSync(join(cwd, s.source?.path ?? ''))), { rows: s.layout?.rows ?? [], alphaThreshold: s.alphaThreshold, background: s.background })[0]?.[frame];
    return { action: p.anim, frame, scale: round(p.im.result.scale, 4), ...(h && refH ? { drawnRatioToSizeRef: round(h / refH, 3) } : {}) };
  });
  const idle = parts.find((p) => p.anim === 'idle');
  const base = idle ? anchorFrame(idle) : parts.map(anchorFrame).find((f) => f !== undefined);
  const head = base ? headWidth(base) : 0;
  const heads = parts.flatMap((p) => { const f = anchorFrame(p); return f ? [{ action: p.anim, head: headWidth(f) }] : []; });
  const warnings = head > 0 ? heads.filter((h) => h.action !== (idle?.anim ?? heads[0]?.action) && Math.abs(h.head / head - 1) > HEAD_TOLERANCE)
    .map((h) => ({ id: 'anim.scale-consistency', note: `${h.action} 머리 폭 ${h.head}px vs ${idle ? 'idle' : heads[0]?.action} ${head}px(±10% 밖)` })) : [];
  return { scaleAnchor, heads: [...heads], idleHead: head, warnings };
}
