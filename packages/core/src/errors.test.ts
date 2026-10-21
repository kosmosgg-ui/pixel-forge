import { describe, expect, it } from 'vitest';
import { EXIT_INTERNAL, EXIT_OK, EXIT_QA_FAILED, EXIT_VALIDATION, ForgeError } from './errors.js';

describe('ForgeError', () => {
  it('code, message, detail을 보관한다', () => {
    const e = new ForgeError('spec.invalid', '스키마 위반', { path: 'parts[0]' });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('spec.invalid');
    expect(e.message).toBe('스키마 위반');
    expect(e.detail).toEqual({ path: 'parts[0]' });
  });

  it('종료 코드는 0~3으로 고정이다', () => {
    expect([EXIT_OK, EXIT_VALIDATION, EXIT_QA_FAILED, EXIT_INTERNAL]).toEqual([0, 1, 2, 3]);
  });
});
