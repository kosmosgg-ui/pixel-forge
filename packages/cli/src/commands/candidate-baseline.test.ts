import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { candidateSchema, covers } from './candidate-contract.js';
import { finishCandidate, protectCandidate } from './candidate-baseline.js';
import { decodePng, encodePng } from '../io/png.js';
import * as files from '../io/files.js';
import { writeRowExport, loadTarget } from './import-target.js';
import { readState, stateFile, withStateUpdate } from '../prompts/state.js';
const root = join(import.meta.dirname, '..', '..', '..', '..');
const work = mkdtempSync(join(tmpdir(), 'forge-baseline-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
afterEach(() => rmSync(join(work, 'data'), { recursive: true, force: true }));
const colors = (png: Buffer) => { const im = decodePng(png), set = new Set<string>(); for (let i = 0; i < im.rgba.length; i += 4) if (im.rgba[i + 3]) set.add([...im.rgba.subarray(i, i + 3)].join()); return set; };
function sheet(dir: string, anims = ['idle', 'walk'], color = 20) {
  const rgba = new Uint8Array(anims.length * 8 * 4 * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([color + (i / 4) % 20, 50, 100, 255], i);
  return { png: encodePng({ w: anims.length * 8, h: 4, rgba }), manifest: candidateSchema.parse({ assetId: 'hero', quality: 'candidate', frame_size: [4, 4], sheet_size: [anims.length * 8, 4], anchor: [2, 3], display_scale: 2, rows: { [dir]: 0 }, mirror: { left: 'right' }, animations: Object.fromEntries(anims.map((name, i) => [name, { start_column: i * 2, frames: 2, fps: 4, loop: true, ...(name === 'walk' ? { stride_px: 16 } : {}) }])), provenance: { sourceFile: 'original.png' }, qa: { pass: true, warnings: [] } }) };
}
function store(dir: string, data: ReturnType<typeof sheet>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'hero_sheet.png'), data.png);
  writeFileSync(join(dir, 'hero_manifest.json'), JSON.stringify(data.manifest));
}
describe('후보 보존과 전체 공통 팔레트', () => {
  it('원본 없이 보관한 baseline과 새 정면을 합쳐 기존 옆 픽셀/동작/보폭을 보존한다', () => {
    const old = sheet('right'), fresh = sheet('down', ['idle'], 100);
    store(join(work, 'data/import/hero/baseline'), old);
    const merged = finishCandidate(work, 'hero', fresh.png, fresh.manifest);
    expect(covers(merged.manifest, 'walk', 'right')).toBe(true);
    expect(covers(merged.manifest, 'walk', 'down')).toBe(false);
    expect(merged.manifest.animations['walk']?.stride_px).toBe(16);
    const image = decodePng(merged.png), before = decodePng(old.png), row = merged.manifest.rows['right']!;
    for (let y = 0; y < 4; y++) expect(image.rgba.subarray((row * 4 + y) * image.w * 4, (row * 4 + y + 1) * image.w * 4)).toEqual(before.rgba.subarray(y * before.w * 4, (y + 1) * before.w * 4));
    expect(merged.manifest.provenance['baseline']).toMatchObject({ kind: 'derived-candidate-not-original' });
  });
  it('불완전 재합성의 덮어쓰기와 합격 상태 확정을 함께 막는다', () => {
    const old = sheet('right'), fresh = sheet('down', ['idle']);
    const local = join(work, 'out/guard'); store(local, old);
    const file = join(local, 'hero_sheet.png'), before = readFileSync(file);
    expect(() => withStateUpdate(work, 'hero', { items: { idle_front: { status: '합격', fails: 0 } } }, () => protectCandidate(work, loadTarget('seonggeom', root), 'hero', fresh.manifest, local, 'out/game'))).toThrow(expect.objectContaining({ code: 'make.coverage-loss' }));
    expect(readFileSync(file)).toEqual(before);
    expect(readState(work, 'hero').items).toEqual({});
    expect(() => readFileSync(stateFile(work, 'hero'))).toThrow();
  });
  it('캐릭터 전체 팔레트 상한/알파/결정론을 보장한다', () => {
    store(join(work, 'data/import/hero/baseline'), sheet('right'));
    const fresh = sheet('down', ['idle'], 120);
    const a = finishCandidate(work, 'hero', fresh.png, fresh.manifest, 2), b = finishCandidate(work, 'hero', fresh.png, fresh.manifest, 2);
    expect(colors(a.png).size).toBeLessThanOrEqual(2);
    expect(a.png).toEqual(b.png);
    const before = decodePng(finishCandidate(work, 'hero', fresh.png, fresh.manifest).png), after = decodePng(a.png);
    expect(after.rgba.filter((_, i) => i % 4 === 3)).toEqual(before.rgba.filter((_, i) => i % 4 === 3));
    expect(a.manifest.provenance['commonPalette']).toMatchObject({ scope: 'character', budget: 2 });
  });
  it('부분 출력 실패 시 기존 PNG/매니페스트와 상태 바이트를 복구한다', () => {
    const old = sheet('right'), fresh = sheet('right', ['idle', 'walk'], 120);
    const local = join(work, 'out/rollback'); store(local, old);
    const state = stateFile(work, 'hero'); mkdirSync(join(work, 'data/import/hero'), { recursive: true });
    const originalState = '{"items":{}}\n'; writeFileSync(state, originalState);
    const write = files.writeFileEnsured;
    const spy = vi.spyOn(files, 'writeFileEnsured');
    // State write, first PNG, then manifest failure: restore all prior bytes.
    spy.mockImplementationOnce(write).mockImplementationOnce(write).mockImplementationOnce(() => { spy.mockRestore(); throw new Error('simulated disk failure'); });
    expect(() => withStateUpdate(work, 'hero', { items: {} }, () => writeRowExport(work, loadTarget('seonggeom', root), 'hero', fresh.png, fresh.manifest, local, 'out/game'))).toThrow('simulated disk failure');
    spy.mockRestore();
    expect(readFileSync(join(local, 'hero_sheet.png'))).toEqual(old.png);
    expect(JSON.parse(readFileSync(join(local, 'hero_manifest.json'), 'utf8'))).toEqual(old.manifest);
    expect(readFileSync(state, 'utf8')).toBe(originalState);
  });
  it('잘못된 셀/시트/시간 범위를 거부한다', () => {
    const m = sheet('right').manifest;
    expect(() => candidateSchema.parse({ ...m, frame_size: [0, 4] })).toThrow();
    expect(() => candidateSchema.parse({ ...m, sheet_size: [4, 4] })).toThrow();
    expect(() => candidateSchema.parse({ ...m, rows: { right: 2 } })).toThrow();
    expect(() => candidateSchema.parse({ ...m, animations: { idle: { ...m.animations['idle'], frame_ms: [100] } } })).toThrow();
  });
  it('불완전 baseline과 방향별 프레임 계약 충돌은 중단한다', () => {
    const dir = join(work, 'data/import/hero/baseline'), old = sheet('right'), fresh = sheet('down', ['idle']);
    store(dir, old); rmSync(join(dir, 'hero_sheet.png'));
    expect(() => finishCandidate(work, 'hero', fresh.png, fresh.manifest)).toThrow(expect.objectContaining({ code: 'make.baseline' }));
    store(dir, old); fresh.manifest.animations['idle']!.loop = false;
    expect(() => finishCandidate(work, 'hero', fresh.png, fresh.manifest)).toThrow(expect.objectContaining({ code: 'make.baseline' }));
    fresh.manifest.animations['idle']!.loop = true; fresh.manifest.animations['idle']!.fps = 5;
    expect(() => finishCandidate(work, 'hero', fresh.png, fresh.manifest)).toThrow(expect.objectContaining({ code: 'make.baseline' }));
  });
});
it('approved Sera cleanup runs before common palette, preserving alpha and recording corrected colors', () => {
  const source = sheet('right', ['idle']); source.manifest.assetId = 'hero_sera';
  const image = decodePng(source.png);
  for (let i = 0; i < image.rgba.length; i += 4) image.rgba.set([83, 93, 56, 255], i);
  const result = finishCandidate(work, 'hero_sera', encodePng(image), source.manifest, 1), after = decodePng(result.png);
  expect([...colors(result.png)]).toEqual(['83,83,56']);
  expect(after.rgba.filter((_, i) => i % 4 === 3)).toEqual(image.rgba.filter((_, i) => i % 4 === 3));
  expect(result.manifest.provenance['commonPalette']).toMatchObject({ despilled: image.w * image.h, budget: 1, scope: 'character' });
});
