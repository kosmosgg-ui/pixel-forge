import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodePng } from '../io/png.js';
import { FILE_RULE, promptText, requestList } from '../prompts/assemble.js';
import { selectFixes } from '../prompts/fix-select.js';
import { loadKit } from '../prompts/kit.js';
import { intakeCommand } from './intake.js';
import { makeCommand } from './make.js';
import { promptSha, promptsCommand } from './prompts.js';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const work = mkdtempSync(join(tmpdir(), 'forge-p9m-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
for (const d of ['data/bibles', 'data/rules', 'data/projects/seonggeom']) cpSync(join(root, d), join(work, d), { recursive: true });
mkdirSync(join(work, 'inbox'), { recursive: true });

/** 초록 배경 스트립: n명, 키 h, 칸 간격 90 — odd = 색이 다른 프레임 번호, edge = 마지막 그림을 오른쪽 끝에 붙임 */
function strip(name: string, n: number, o: { odd?: number; edge?: boolean; h?: number } = {}): string {
  const h = o.h ?? 120, W = n * 90 + (o.edge ? -20 : 40), H = h + 40, rgba = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) rgba.set([0, 255, 0, 255], k * 4);
  for (let i = 0; i < n; i++) {
    const x0 = Math.min(30 + i * 90, W - 40), body = i === o.odd ? [40, 200, 220, 255] : [200, 40, 40, 255];
    for (let y = 20; y < 20 + h; y++) for (let x = x0; x < x0 + 40; x++) {
      const edge = x === x0 || x === x0 + 39 || y === 20 || y === 19 + h;
      rgba.set(edge ? [20, 20, 30, 255] : y < 20 + 10 + i * 3 ? [240, 220, 180, 255] : body, (y * W + x) * 4);
    }
  }
  writeFileSync(join(work, 'inbox', name), encodePng({ w: W, h: H, rgba }));
  return `inbox/${name}`;
}

describe('P9-M 요청 문구', () => {
  const kit = loadKit('hero_sera', root);
  const list = requestList(kit);
  it('요청 18개: 턴어라운드 → 옆 7 → 정면·뒷면 5×2, 파일 이름 규칙(소문자·숫자·_, 한글·공백 없음)', () => {
    expect(list).toHaveLength(18);
    expect(list.slice(0, 4).map((r) => r.key)).toEqual(['turnaround_all', 'idle_side', 'walk_side', 'attack_side']);
    expect(list.filter((r) => r.action === 'death' || r.action === 'ultimate').map((r) => r.view)).toEqual(['side', 'side']);
    for (const r of list) expect(r.file).toMatch(FILE_RULE);
    expect(list[2]?.references).toEqual(['sera_ref.png', 'hero_sera__turnaround_all.png']);
  });
  it('조립 골든(문자열 sha256 — 데이터·틀이 바뀌면 의도한 변경인지 확인)', () => {
    const text = (k: string) => promptText(kit, list.find((r) => r.key === k) ?? list[0]!);
    expect(text('walk_side')).toContain('Draw exactly 6 frames of the walk cycle animation, side view facing right');
    expect(text('walk_side')).not.toMatch(/\{\{/);
    expect({ turnaround: promptSha(text('turnaround_all')).slice(0, 16), walk: promptSha(text('walk_side')).slice(0, 16), back: promptSha(text('idle_back')).slice(0, 16) }).toMatchSnapshot();
  });
  it('고치기 문구 고르기: 잘림·identity(프레임 번호)·프레임 수·배경·다리·뒷면 얼굴', () => {
    const base = { sprites: 6, frames: 6, failed: [], backgroundOk: true, view: 'side' };
    expect(selectFixes(base)).toEqual({ ids: [], frameCount: false });
    expect(selectFixes({ ...base, failed: [{ id: 'import.clipped' }] }).ids).toEqual(['clipped']);
    expect(selectFixes({ ...base, failed: [{ id: 'import.identity', note: '다른 캐릭터처럼 보이는 프레임: walk_e_3' }] })).toEqual({ ids: ['identity'], frameCount: false, frame: 4 });
    expect(selectFixes({ ...base, sprites: 5 }).frameCount).toBe(true);
    expect(selectFixes({ ...base, backgroundOk: false, judge: '보폭이 작다' }).ids).toEqual(['background', 'legs']);
    expect(selectFixes({ ...base, view: 'back', judge: '얼굴이 보인다' }).ids).toEqual(['backface']);
  });
});

describe('forge prompts / intake / make', () => {
  it('prompts → CHECKLIST·문구 파일, intake 기록(출처만 — 계정·경로·키 없음), 작은 원본 경고, PNG 외·이름 규칙 오류', () => {
    expect(promptsCommand('hero_sera', work)).toMatchObject({ requests: 18, remaining: 18, next: ['hero_sera__turnaround_all.png', 'hero_sera__idle_side.png', 'hero_sera__walk_side.png'] });
    const r = intakeCommand(strip('hero_sera__walk_side.png', 6), work, { at: '2026-10-22T12:00:00.000Z' });
    expect(r).toMatchObject({ key: 'walk_side', stamp: expect.stringMatching(/^20261022T120000Z_[0-9a-f]{8}$/), warnings: [expect.stringContaining('1024')] });
    const meta = readFileSync(join(work, r.out.replace('.png', '.intake.json')), 'utf8');
    expect(Object.keys(JSON.parse(meta)).sort()).toEqual(['createdAt', 'model', 'origin', 'promptFile', 'promptSha256', 'receivedFrom', 'references', 'sha256', 'size', 'sourceName', 'warnings']);
    expect(meta).not.toMatch(/@|kosmosgg|\/root|\/home|tmp/);
    expect(readFileSync(join(work, 'out/prompts/hero_sera/CHECKLIST.md'), 'utf8')).toContain('| 3 | `hero_sera__walk_side.png`');
    writeFileSync(join(work, 'inbox/x.png'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    expect(() => intakeCommand('inbox/x.png', work, { as: 'hero_sera/walk_side' })).toThrow(expect.objectContaining({ code: 'intake.format' }));
    expect(() => intakeCommand('inbox/x.png', work)).toThrow(expect.objectContaining({ code: 'intake.name' }));
    expect(() => intakeCommand('../x.png', work, { as: 'hero_sera/walk_side' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
  });
  it('make 합격 → 후보 시트·G1 매니페스트(candidate·provenance 사용자 생성물), 불합격 → 고치기 문구(잘림·다른 캐릭터·프레임 수)', () => {
    const ok = makeCommand('hero_sera', work, { action: 'walk', dir: 'side', out: 'game' });
    expect(ok).toMatchObject({ pass: true, exported: { dest: 'game/hero_sera', rows: ['right_side'], columns: 6 } });
    const m = JSON.parse(readFileSync(join(work, 'game/hero_sera/hero_sera_manifest.json'), 'utf8'));
    expect(m).toMatchObject({ assetId: 'hero_sera', quality: 'candidate', anchor: [32, 78], display_scale: 2, rows: { right: 0 }, mirror: { left: 'right' }, animations: { walk: { frames: 6, fps: 10, loop: true, stride_px: 24 } }, provenance: { creator: 'user via ChatGPT', aiUsed: true, rightsReviewed: false } });
    intakeCommand(strip('a.png', 5), work, { as: 'hero_sera/idle_side', at: '2026-10-22T12:00:01.000Z' });
    expect(makeCommand('hero_sera', work, { action: 'idle', dir: 'side', out: 'game' })).toMatchObject({ pass: false, frameCount: true });
    intakeCommand(strip('b.png', 4, { edge: true }), work, { as: 'hero_sera/idle_side', at: '2026-10-22T12:00:02.000Z' });
    expect(makeCommand('hero_sera', work, { action: 'idle', dir: 'side', out: 'game' })).toMatchObject({ pass: false, fixes: ['clipped'], fails: 2, advice: expect.stringContaining('새 대화') });
    intakeCommand(strip('c.png', 5, { odd: 2 }), work, { as: 'hero_sera/hit_side', at: '2026-10-22T12:00:03.000Z' });
    intakeCommand(strip('d.png', 3, { odd: 2 }), work, { as: 'hero_sera/hit_side', at: '2026-10-22T12:00:04.000Z' });
    const bad = makeCommand('hero_sera', work, { action: 'hit', dir: 'side', out: 'game' });
    expect(bad).toMatchObject({ pass: false, fixes: expect.arrayContaining(['identity']) });
    expect(readFileSync(join(work, String(bad.pass ? '' : bad.fix)), 'utf8')).toContain('Frame 3 looks like a different character');
    expect(readdirSync(join(work, 'data/import/hero_sera/idle_side')).filter((f) => f.endsWith('.png'))).toHaveLength(2);
  });
});
