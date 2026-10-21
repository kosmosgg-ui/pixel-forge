import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { Report } from '@pixel-forge/qa';
import { loadProject } from '../io/project.js';
import { buildCommand } from './build.js';
import { renderProject } from './qa.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-grid-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));

// 10×12 작은 몬스터: 머리(s)·눈(k=@eye)·몸(b)·다리. 외곽선은 그리지 않는다
const legend = { s: 'goblin_skin:2', S: 'goblin_skin:3', d: 'goblin_skin:1', k: '@eye', b: 'leather:1', w: 'bone:2' };
const rows = [
  '...ssss...', '..sSSsss..', '.sSSssssd.', '.sSskssdd.', '.ssswwsdd.', '..sssssd..',
  '...bbbb...', '..bbbbbb..', '..bbbbbb..', '...b..b...', '...d..d...', '..dd..dd..',
];
const spec = {
  id: 'gridmon', kind: 'character', bible: 'sample-v0', sizeClass: 'smallMonster', mode: 'frames', sizeClassLock: true,
  grid: { rows, legend },
  frames: {
    idle: [{ ms: 160, patch: { at: [0, 0], rows: ['~...ssss..'], legend } }, { ms: 160, patch: { at: [3, 4], rows: ['ww'], legend } }],
    hit: [{ ms: 60, patch: { at: [0, 0], rows: ['.'], legend }, fx: 'flash' }, { ms: 120, grid: { rows: rows.map((r) => r.slice(1) + '.'), legend } }],
  },
};

describe('프레임 모드(그리드 직접 설계)', () => {
  const path = join(work, 'data/specs/sample/gridmon.spec.json');
  writeFileSync(path, JSON.stringify(spec));

  it('build: 필수 검사 통과, 외곽선은 엔진이 등급 모드(dark 단색)로 붙임, @eye는 외곽선색 눈', () => {
    const r = buildCommand('data/specs/sample/gridmon.spec.json', work);
    expect(r).toMatchObject({ ok: true, pass: true });
    const report = JSON.parse(readFileSync(join(work, 'out/gridmon/qa.json'), 'utf8')) as Report;
    expect(report.checks.find((c) => c.id === 'anim.flicker')).toMatchObject({ pass: true, value: 0 });
    const p = loadProject('data/specs/sample/gridmon.spec.json', work);
    const out = renderProject(p);
    const R = out.rest.raster;
    const outline = out.palette.outlineIndex;
    // 첫 행 위(그리드 밖)에 외곽선이 있고, 눈 칸도 외곽선색
    expect(Array.from(R.px).filter((v) => v === outline).length).toBeGreaterThan(20);
    expect(out.rest.meta.eyes).toHaveLength(1);
    expect(R.px[out.rest.meta.eyes[0] ?? 0]).toBe(outline);
    expect(out.frames.map((f) => `${f.anim}${f.index}`)).toEqual(['idle0', 'idle1', 'hit0', 'hit1']);
  });

  it('patch 프레임은 base 영역(파츠 1)이 rest와 같고 patch 칸만 다름, grid 프레임은 전체가 새 그림', () => {
    const p = loadProject('data/specs/sample/gridmon.spec.json', work);
    const out = renderProject(p);
    expect(out.frames[0]?.meta.partTransforms[0]).toEqual([0, 0, 0]);
    expect(out.frames[3]?.meta.partTransforms[0]?.[2]).not.toBe(0);
    // "~"로 지운 칸은 투명(외곽선 아님 또는 비어 있음)
    const diff = Array.from(out.frames[1]!.raster.px).filter((v, k) => v !== out.rest.raster.px[k]).length;
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(8);
  });

  it('범례에 없는 재질·단계는 validate에서 거부(spec.refs)', () => {
    writeFileSync(path, JSON.stringify({ ...spec, grid: { rows, legend: { ...legend, s: 'goblin_skin:9' } } }));
    try {
      expect(() => buildCommand('data/specs/sample/gridmon.spec.json', work)).toThrow(expect.objectContaining({ code: 'spec.refs' }));
    } finally { writeFileSync(path, JSON.stringify(spec)); }
  });
});
