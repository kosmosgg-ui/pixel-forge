import { isAbsolute, relative, resolve } from 'node:path';
import { ForgeError } from '@pixel-forge/core';

/**
 * base 기준으로 경로를 정규화하고, 결과가 base 밖이면(`../`로 빠져나가거나 다른 절대 경로) 거부한다.
 * 사용자·Spec이 준 경로로 저장소 밖 파일을 읽거나 덮어쓰지 않게 하기 위해서다.
 */
export function resolveInside(base: string, path: string): string {
  const root = resolve(base);
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (rel === '..' || rel.startsWith(`..${'/'}`) || rel.startsWith('..\\') || isAbsolute(rel)) {
    throw new ForgeError('io.path-escape', `지정 폴더 밖 경로입니다: ${path}`, { base: root, path });
  }
  return full;
}
