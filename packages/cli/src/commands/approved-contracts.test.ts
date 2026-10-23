import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bibleSchema } from '@pixel-forge/spec';
import { loadKit } from '../prompts/kit.js';
import { promptText, requestList } from '../prompts/assemble.js';
import { fxSource } from './fx-source.js';
import { unifiedCell } from './make-compose.js';
import { palOf } from './fx-import.js';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const work = mkdtempSync(join(tmpdir(), 'forge-approvals-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));
const bible = bibleSchema.parse(JSON.parse(readFileSync(join(root, 'data/projects/seonggeom/seonggeom.bible.json'), 'utf8')));

describe('승인 6건 실행 계약', () => {
  it('승인 셀로 작은 원본을 합성해도 논리 키·발밑 여백 유지, 계약 밖 원본은 중단', () => {
    const base = { w: 48, h: 64, anchor: [24, 62] as const };
    expect(unifiedCell([base], bible.sizeClassOptions['hero']?.sheetSize)).toEqual({ w: 112, h: 80, anchor: [56, 78] });
    expect(() => unifiedCell([{ w: 128, h: 80, anchor: [64, 78] }], [112, 80])).toThrow(expect.objectContaining({ code: 'make.cell-contract' }));
    expect(bible.colorBudget).toEqual({ hero: 32, enemy_small: 24, beast: 24, elite: 24, boss: 24 });
    expect(bible.materials['metal_blade']).toMatchObject({ base: '#c8d4dc', steps: 3, kind: 'metal' });
  });
  it('실제 이펙트는 바이블 팔레트를 읽고, 바이블 변경은 생성 소스·QA 기준에 함께 반영', () => {
    const source = join(root, 'data/projects/seonggeom/fx/sg_fx.px.js');
    const prepared = fxSource(source, bible, work);
    expect(palOf(prepared.text).size).toBe(13);
    expect(prepared.colors).toContain('#7ff0e6');
    const changed = fxSource(source, { ...bible, fxPalette: { ...bible.fxPalette, c: '#123456' } }, work);
    expect(palOf(changed.text).has(0x123456)).toBe(true);
    expect(palOf(changed.text).has(0x7ff0e6)).toBe(false);
    expect(changed.colors).toContain('#123456');
    expect(() => fxSource(source, { ...bible, fxPalette: undefined }, work)).toThrow(expect.objectContaining({ code: 'fx.palette' }));
  });
  it('잘못된 바이블 팔레트는 진입 검증에서 거부, 독립 pxl 소스는 보존', () => {
    expect(bibleSchema.safeParse({ ...bible, fxPalette: { c: 'green' } }).success).toBe(false);
    const file = join(work, 'plain.px.js');
    writeFileSync(file, 'pal({ w: "#ffffff" })');
    expect(fxSource(file, bible, work).file).toBe(file);
  });
  it('3직업 요청은 실제 조립 경로로 생성되고 동일인성·장검·참조·32색 유지', () => {
    for (const cls of ['guard', 'swift', 'rune']) {
      const kit = loadKit(`hero_sera_${cls}`, root), requests = requestList(kit);
      const req = requests.find((r) => r.key === 'idle_side');
      expect(req).toBeDefined();
      expect(req?.references).toContain('hero_sera__size_ref.png');
      const text = promptText(kit, req!);
      expect(text).toContain('Same brown eyes, face');
      expect(text).toContain('same face and body proportions');
      expect(text).not.toMatch(/\{\{/);
      expect(kit.actor.paletteMax).toBe(32);
      expect(kit.actor.sizeClass).toBe('hero');
    }
    const rune = loadKit('hero_sera_rune', root);
    expect(rune.actor.description).toContain('rune LONGSWORD');
  });
});
