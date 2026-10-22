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
    expect(list[0]?.file).toBe('hero_sera__turnaround.png');
    expect(list.filter((r) => r.action === 'death' || r.action === 'ultimate').map((r) => r.view)).toEqual(['side', 'side']);
    for (const r of list.slice(1)) expect(r.file).toMatch(FILE_RULE);
    expect(list[2]?.references).toEqual(['hero_sera__ref.png', 'hero_sera__turnaround.png', 'hero_sera__size_ref.png']);
  });
  it('조립 골든(문자열 sha256 — 데이터·틀이 바뀌면 의도한 변경인지 확인)', () => {
    const text = (k: string) => promptText(kit, list.find((r) => r.key === k) ?? list[0]!);
    expect(text('walk_side')).toContain('Draw exactly 6 frames of the walk cycle animation, side view facing right');
    expect(text('walk_side')).not.toMatch(/\{\{/);
    expect(text('walk_side')).toMatch(/three-quarter top-down view[\s\S]*No slash trails/);
    expect(text('walk_side')).toMatch(/exactly the same size as in the attached size reference/);
    expect(text('walk_side')).not.toMatch(/blue cape|long cape/);
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

describe('G2 U2 적 요청 문구', () => {
  it('적: 턴어라운드 없음, 참조 = 원화 + 세라 size_ref, 캐릭터 전용 동작(고블린 walk ≠ 오크 walk), 대장 7동작·패턴 시간 ms', () => {
    const g = loadKit('enemy_goblin', root), o = loadKit('enemy_orc', root), c = loadKit('enemy_orc_captain', root);
    const gl = requestList(g);
    expect(gl.map((r) => r.key)).toEqual(['walk_side', 'attack_side', 'hit_side', 'death_side']);
    expect(gl[0]?.references).toEqual(['enemy_goblin__ref.png', 'hero_sera__size_ref.png']);
    expect(g.actions.walk?.poses[0]).not.toEqual(o.actions.walk?.poses[0]);
    expect(requestList(c)).toHaveLength(7);
    expect(c.actions.cleave).toMatchObject({ frames: 6, ms: [300, 300, 300, 120, 400, 400], phases: { telegraph: [0, 1, 2], active: [3], recovery: [4, 5] }, hold: 2 });
    const text = promptText(g, gl[1]!);
    expect(text).toMatch(/clean weapons, no blood/);
    expect(text).toMatch(/0\.7 times the height of the girl/);
    expect(text).toMatch(/magenta #FF00FF/);
    expect(promptText(loadKit('enemy_wolf', root), requestList(loadKit('enemy_wolf', root))[0]!)).toMatch(/green #00FF00/);
  });
});

describe('forge prompts / intake / make', () => {
  it('prompts → CHECKLIST·문구 파일, intake 기록(출처만 — 계정·경로·키 없음), 작은 원본 경고, PNG 외·이름 규칙 오류', () => {
    expect(promptsCommand('hero_sera', work)).toMatchObject({ requests: 18, remaining: 18, next: ['hero_sera__turnaround.png', 'hero_sera__idle_side.png', 'hero_sera__walk_side.png'] });
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
  it('참조 이미지(--kind reference) 등록 → 턴어라운드 등록, --temp 원본은 재요청으로 다음 요청 맨 앞', () => {
    const turn = strip('hero_sera__turnaround.png', 3);
    expect(intakeCommand(turn, work, { kind: 'reference', at: '2026-10-22T11:00:00.000Z' })).toMatchObject({ kind: 'reference', name: 'turnaround', turnaround: true });
    expect(intakeCommand(strip('hero_sera__ref.png', 1), work, { kind: 'reference', at: '2026-10-22T11:00:01.000Z' })).toMatchObject({ name: 'ref', turnaround: false });
    expect(() => intakeCommand(turn, work, { kind: 'cutout' })).toThrow(expect.objectContaining({ code: 'intake.kind' }));
    expect(intakeCommand(strip('hero_sera__walk_side.png', 6), work, { at: '2026-10-22T11:00:02.000Z', temp: '망토 없음' })).toMatchObject({ status: '재요청', note: '망토 없음' });
    const r = promptsCommand('hero_sera', work);
    expect(r.next).toEqual(['hero_sera__walk_side.png', 'hero_sera__idle_side.png', 'hero_sera__attack_side.png']);
    expect(readFileSync(join(work, 'out/prompts/hero_sera/CHECKLIST.md'), 'utf8')).toMatch(/hero_sera__turnaround\.png.*등록 \|[\s\S]*walk_side\.png.*재요청 \(망토 없음\)/);
  });
  it('G2 U1: 같은 이름 참조 재등록 → 이전 것 superseded, --retake로 재요청 표시', () => {
    intakeCommand(strip('hero_sera__ref.png', 1), work, { kind: 'reference', at: '2026-10-22T13:00:00.000Z' });
    const dir = join(work, 'data/import/hero_sera/references/ref');
    const metas = readdirSync(dir).filter((f) => f.endsWith('.intake.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { superseded?: boolean });
    expect(metas.map((m) => m.superseded === true)).toEqual([...metas.slice(0, -1).map(() => true), false]);
    expect(promptsCommand('hero_sera', work, { retake: 'attack_side,hit_side', note: '보드 크기·궤적' }).next).toEqual(expect.arrayContaining(['hero_sera__attack_side.png', 'hero_sera__hit_side.png']));
    expect(() => promptsCommand('hero_sera', work, { retake: 'nope_side' })).toThrow(expect.objectContaining({ code: 'prompts.key' }));
  });
  it('make 합격 → 후보 시트·G1 매니페스트(candidate·provenance 사용자 생성물), 불합격 → 고치기 문구(잘림·다른 캐릭터·프레임 수)', () => {
    const ok = makeCommand('hero_sera', work, { action: 'walk', dir: 'side', out: 'game' });
    expect(ok).toMatchObject({ pass: true, exported: { dest: 'game/hero_sera', rows: ['right_side'], columns: 6 } });
    const m = JSON.parse(readFileSync(join(work, 'game/hero_sera/hero_sera_manifest.json'), 'utf8'));
    expect(m).toMatchObject({ assetId: 'hero_sera', quality: 'candidate', anchor: [24, 62], display_scale: 2, rows: { right: 0 }, mirror: { left: 'right' }, animations: { walk: { frames: 6, fps: 10, loop: true, stride_px: expect.any(Number) } }, provenance: { creator: 'user via ChatGPT', aiUsed: true, rightsReviewed: false } });
    expect(m.animations.walk.stride_px).toBeGreaterThan(0);
    // --temp 원본(망토 없음): 변환 합격 → 후보로 내보내되 상태는 재요청 유지
    expect(JSON.parse(readFileSync(join(work, 'data/import/hero_sera/state.json'), 'utf8')).items.walk_side).toMatchObject({ status: '재요청', made: true });
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
