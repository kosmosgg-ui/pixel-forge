import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ForgeError } from '@pixel-forge/core';
import { resolveInside } from './paths.js';

const base = resolve('/work/project');

describe('resolveInside', () => {
  it('폴더 안 경로는 정규화한 절대 경로', () => {
    expect(resolveInside(base, 'data/bibles/a.json')).toBe(join(base, 'data/bibles/a.json'));
    expect(resolveInside(base, 'data/../data/x.json')).toBe(join(base, 'data/x.json'));
  });

  it('../ 로 빠져나가는 경로는 io.path-escape', () => {
    for (const p of ['../secret.json', 'data/../../x', '..']) {
      try {
        resolveInside(base, p);
        expect.unreachable(p);
      } catch (e) {
        expect(e).toBeInstanceOf(ForgeError);
        expect((e as ForgeError).code).toBe('io.path-escape');
      }
    }
  });

  it('폴더 밖 절대 경로는 거부, 안쪽 절대 경로는 허용', () => {
    expect(() => resolveInside(base, '/etc/passwd')).toThrow(ForgeError);
    expect(resolveInside(base, join(base, 'out/a.png'))).toBe(join(base, 'out/a.png'));
  });

  it('이름이 ..로 시작하는 폴더 안 파일은 허용', () => {
    expect(resolveInside(base, '..cache/x')).toBe(join(base, '..cache/x'));
  });
});
