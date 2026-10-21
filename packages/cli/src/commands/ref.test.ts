import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { refAnalyzeCommand, refCompareCommand } from './ref.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'forge-ref-'));
cpSync(join(repo, 'data'), join(work, 'data'), { recursive: true });
afterAll(() => rmSync(work, { recursive: true, force: true }));
// 저장소에 외부 이미지를 두지 않으므로 forge가 렌더한 rest 프레임을 레퍼런스 입력으로 쓴다
const png = 'ref-in.png';

describe('forge ref', () => {
  it('analyze: 측정값 JSON만 data/refs/에, 원본 이미지는 복사하지 않음, 라이선스·출처 필수(ref.license·ref.source)', async () => {
    const { renderCommand } = await import('./render.js');
    renderCommand('data/specs/sample/mage.spec.json', work);
    cpSync(join(work, 'out/mage/frames/rest.png'), join(work, png));
    expect(() => refAnalyzeCommand(png, work, { source: 'x' })).toThrow(expect.objectContaining({ code: 'ref.license' }));
    expect(() => refAnalyzeCommand(png, work, { license: 'CC0' })).toThrow(expect.objectContaining({ code: 'ref.source' }));
    expect(() => refAnalyzeCommand('none.png', work, { license: 'CC0', source: 'x' })).toThrow(expect.objectContaining({ code: 'io.not-found' }));
    expect(() => refAnalyzeCommand('../x.png', work, { license: 'CC0', source: 'x' })).toThrow(expect.objectContaining({ code: 'io.path-escape' }));
    const r = refAnalyzeCommand(png, work, { source: 'https://example.invalid/mage', license: 'CC0', id: 'mage-ref' });
    expect(r).toMatchObject({ ok: true, id: 'mage-ref', license: 'CC0', out: 'data/refs/mage-ref.ref.json' });
    const refs = readdirSync(join(work, 'data/refs'));
    expect(refs).toContain('mage-ref.ref.json');
    expect(refs.every((f) => f.endsWith('.ref.json'))).toBe(true);
    const json = JSON.parse(readFileSync(join(work, r.out), 'utf8')) as { license: string; measure: { silhouette: { heightPx: number } } };
    expect(json.license).toBe('CC0');
    expect(json.measure.silhouette.heightPx).toBeGreaterThan(20);
  });

  it('compare: 같은 캐릭터면 실루엣 키·색 수 차이 0, 표 JSON을 out/<id>/에', () => {
    const r = refCompareCommand('data/specs/sample/mage.spec.json', 'data/refs/mage-ref.ref.json', work);
    expect(existsSync(join(work, r.out))).toBe(true);
    const rows = (JSON.parse(readFileSync(join(work, r.out), 'utf8')) as { rows: { metric: string; diff: number | null }[] }).rows;
    expect(rows.find((x) => x.metric === 'silhouette.heightPx')?.diff).toBe(0);
    expect(rows.find((x) => x.metric === 'uniqueColors')?.diff).toBe(0);
  });
});
