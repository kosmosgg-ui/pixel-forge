import { ForgeError } from '@pixel-forge/core';
import { dirAdapter } from './dir.js';
import type { Adapter } from './types.js';

export type { Adapter, ApplyOptions, ApplyResult, Artifacts } from './types.js';

/** 등록된 어댑터. 엔진별 어댑터는 파일 하나 + 여기 한 줄로 추가 */
const ADAPTERS: readonly Adapter[] = [dirAdapter];

export function getAdapter(id: string): Adapter {
  const a = ADAPTERS.find((x) => x.id === id);
  if (!a) throw new ForgeError('apply.unknown-target', `알 수 없는 어댑터: ${id} (지원: ${ADAPTERS.map((x) => x.id).join(', ')})`);
  return a;
}
