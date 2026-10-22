import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { z } from 'zod';
import { ForgeError } from '@pixel-forge/core';
import type { PassFrame, PrerenderPasses } from '@pixel-forge/render';

const passesSchema = z.object({
  materials: z.array(z.string()),
  objects: z.array(z.object({ name: z.string(), skinned: z.boolean() })),
  fps: z.number().positive(),
  pxPerUnit: z.number().positive(),
  frames: z.array(z.object({ anim: z.string(), dir: z.string(), index: z.number().int().min(0), frame: z.number().int(), objects: z.array(z.string()) })),
});
export type PassesFile = z.infer<typeof passesSchema>;

function readPng(path: string, w: number, h: number): Buffer {
  const p = PNG.sync.read(readFileSync(path));
  if (p.width !== w || p.height !== h) throw new ForgeError('render3d.size', `패스 크기가 다릅니다: ${path} ${p.width}×${p.height} ≠ ${w}×${h}`);
  return p.data;
}

/** 원본 프레임 번호 간격 → ms(마지막 프레임은 앞 간격). 키 포즈 중심으로 띄엄띄엄 뽑으므로 간격이 곧 표시 시간 */
export function frameMs(frames: readonly number[], fps: number): number[] {
  return frames.map((f, i) => {
    const next = frames[i + 1], prev = frames[i - 1];
    const gap = next !== undefined ? next - f : prev !== undefined ? f - prev : 1;
    return Math.max(1, Math.round((Math.max(1, gap) * 1000) / fps));
  });
}

/**
 * 패스 폴더 → PrerenderPasses. id 패스: R = 재질 번호, G = 오브젝트 번호(알파 255인 칸만).
 * 법선 패스(카메라 공간, x 오른쪽·y 위·z 카메라 반대쪽)는 화면 공간(x 오른쪽·y 아래·z 보는 사람 쪽)으로 바꾼다.
 */
export function readPasses(dir: string, size: readonly [number, number], supersample: number, frames: Readonly<Record<string, readonly number[]>>): PrerenderPasses & { file: PassesFile } {
  const file = passesSchema.parse(JSON.parse(readFileSync(join(dir, 'passes.json'), 'utf8')));
  const W = size[0] * supersample, H = size[1] * supersample, n = W * H;
  const keys = new Map<string, number>();
  const msOf = Object.fromEntries(Object.entries(frames).map(([a, fs]) => [a, frameMs(fs, file.fps)]));
  let unique = 0;
  const out: PassFrame[] = file.frames.map((f) => {
    const base = join(dir, `${f.anim}_${f.dir}_${f.index}`);
    const id = readPng(`${base}_id.png`, W, H), nrm = readPng(`${base}_nrm.png`, W, H), alb = readPng(`${base}_alb.png`, W, H);
    const mat = new Uint8Array(n), obj = new Uint8Array(n), normal = new Int8Array(n * 3), albedo = new Uint8Array(n * 3);
    for (let k = 0; k < n; k++) {
      if ((id[k * 4 + 3] ?? 0) < 128) continue;
      mat[k] = id[k * 4] ?? 0;
      obj[k] = id[k * 4 + 1] ?? 0;
      for (let c = 0; c < 3; c++) albedo[k * 3 + c] = alb[k * 4 + c] ?? 0;
      const v = (c: number) => ((nrm[k * 4 + c] ?? 128) / 255) * 2 - 1;
      normal[k * 3] = Math.round(v(0) * 127);
      normal[k * 3 + 1] = Math.round(-v(1) * 127);
      normal[k * 3 + 2] = Math.round(-v(2) * 127);
    }
    // 스키닝 메시는 행렬이 같아도 정점이 움직이므로 매번 새 값(깜빡임 검사에서 정지로 보지 않게)
    const transforms = f.objects.map((h, i) => (file.objects[i]?.skinned ? --unique : keys.get(h) ?? (keys.set(h, keys.size + 1), keys.size)));
    return { anim: f.anim, dir: f.dir, index: f.index, ms: msOf[f.anim]?.[f.index] ?? 100, mat, obj, normal, albedo, transforms };
  });
  return { supersample, materials: file.materials, frames: out, file };
}
