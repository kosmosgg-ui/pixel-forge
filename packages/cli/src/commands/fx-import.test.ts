import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { pxlBin } from '../io/pxl.js';
import { centerIn, fxQa, FX_DIRS, type FxRow } from './fx-frames.js';
import { fxImportCommand, palOf } from './fx-import.js';
import { parseStudy, studyWarnings } from './study.js';

const px = (w: number, h: number, c: [number, number, number, number] | null) => { const rgba = new Uint8Array(w * h * 4); if (c) for (let i = 0; i < w * h; i++) rgba.set(c, i * 4); return { w, h, rgba }; };

describe('fx-import 부품', () => {
  it('pxl 없음·Node 낮음 → fx.pxl-missing(설치 명령 포함)', () => {
    expect(() => pxlBin({ PXL_BIN: '/nope/pxl.js' }, 'v22.22.0')).toThrow(expect.objectContaining({ code: 'fx.pxl-missing', message: expect.stringContaining('checkout 2e72b9a') }));
    const bin = join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js');
    if (existsSync(bin)) expect(() => pxlBin({ PXL_BIN: bin }, 'v22.10.0')).toThrow(expect.objectContaining({ code: 'fx.pxl-missing' }));
  });
  it('pal() 색, 가운데 놓기, fx QA(알파·팔레트·프레임 수·8방향·빈 프레임)', () => {
    expect([...palOf('pal({\n k: "#141824", w: "#FFFFFF" })')]).toEqual([0x141824, 0xffffff]);
    const c = centerIn(px(2, 2, [255, 255, 255, 255]), 6, 4);
    expect([c.rgba[(1 * 6 + 2) * 4 + 3], c.rgba[3]]).toEqual([255, 0]);
    const pal = new Set([0xffffff]);
    const ok: FxRow[] = FX_DIRS.map((d) => ({ name: d, frames: [px(2, 2, [255, 255, 255, 255])], ms: [50] }));
    expect(fxQa(ok, { dirs: 8, loop: false, frames: ['a'] }, pal)).toEqual([]);
    const bad: FxRow[] = [{ name: 'e', frames: [px(2, 2, [255, 0, 0, 128]), px(2, 2, null)], ms: [50, 50] }, { name: 'se', frames: [px(2, 2, [255, 255, 255, 255])], ms: [50] }];
    expect(fxQa(bad, { dirs: 8, loop: false, frames: ['a'] }, pal).map((w) => w.id)).toEqual(['fx.alpha', 'fx.palette', 'fx.frames', 'fx.directions', 'fx.size']);
  });
  it('pxl study 문장 → 수치, 목표 대비 경고(외톨이 15%·밴딩 30 — 제안값)', () => {
    const t = 'Kind: pixel art at 1x: 288x64 as drawn, 23 colors.\n  Steps too close: ramp 1\'s #807c82 to #898073 (0.031 apart in OKLab): x\n  Eyeburn: #12d40b (chroma 0.30 between 0.10 and 0.12): far more saturated than its ramp neighbors\n  Anti-aliasing: in-between tones on the steps of edges on 23% of the pixels\n  Clusters: 26% of the pixels stand alone (x)\n  Banding (x): 166 pairs, 43.7 per 1000 px: much';
    const s = parseStudy(t);
    expect(s).toEqual({ lonePct: 26, bandingPer1000: 43.7, closeSteps: 1, eyeburn: 1, aaPct: 23, colors: 23 });
    expect(studyWarnings(s)).toHaveLength(2);
    expect(parseStudy('')).toMatchObject({ lonePct: null, bandingPer1000: null });
  });
});

const bin = join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js');
describe.skipIf(!existsSync(bin))('forge fx-import(pxl 설치된 환경)', () => {
  const root = join(import.meta.dirname, '..', '..', '..', '..');
  const work = mkdtempSync(join(tmpdir(), 'forge-fx-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));
  it('작은 pxl 소스 → 8방향 행·anim 스트립 → kind fx 매니페스트(aiUsed false·pxl 커밋)', () => {
    for (const d of ['data/bibles', 'data/rules', 'data/projects/seonggeom/seonggeom.bible.json', 'data/projects/seonggeom/target.json']) cpSync(join(root, d), join(work, d), { recursive: true });
    mkdirSync(join(work, 'fx'), { recursive: true });
    writeFileSync(join(work, 'fx/t.px.js'), 'pal({ w: "#ffffff", c: "#7ff0e6" })\nsprite("fx_t_f0", { w: 8, h: 4 }, (c) => c.rect(1, 1, 6, 2, "c"))\nfor (const [i, d] of ["se","s","sw","w","nw","n","ne"].entries()) sprite(`fx_t_f0_${d}`, { base: "fx_t_f0", angle: (i + 1) * 45 })\nanim("fx_a", { w: 6, h: 6, frames: 2, fps: 10 }, (c) => c.px(2 + c.frame, 2, "w"))\n');
    writeFileSync(join(work, 'fx/a.json'), JSON.stringify({ source: 'fx/t.px.js', assets: { fx_t: { dirs: 8, frames: ['fx_t_f0'], ms: [50] }, fx_a: { anim: 'fx_a' } } }));
    const r = fxImportCommand(work, { assets: 'fx/a.json', out: 'game' });
    expect(r).toMatchObject({ count: 2, warnings: [] });
    const m = JSON.parse(readFileSync(join(work, 'game/fx_t/fx_t_manifest.json'), 'utf8'));
    expect(m).toMatchObject({ kind: 'fx', quality: 'candidate', rows: { e: 0, ne: 7 }, provenance: { aiUsed: false, creator: 'pixel-forge/pxl (code-drawn)', editedBy: 'Claude Code', promptRecord: null } });
    expect(JSON.parse(readFileSync(join(work, 'game/fx_a/fx_a_manifest.json'), 'utf8')).animations.play.frames).toBe(2);
  });
});
