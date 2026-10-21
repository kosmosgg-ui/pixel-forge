import { describe, expect, it } from 'vitest';
import * as mod from './index.js';

describe('rig', () => {
  it('모듈을 불러올 수 있다', () => {
    expect(mod).toBeDefined();
  });
});
