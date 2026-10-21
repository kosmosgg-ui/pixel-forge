import { describe, expect, it } from 'vitest';
import { FORGE_VERSION } from './version.js';

describe('FORGE_VERSION', () => {
  it('semver 형식이다', () => {
    expect(FORGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
