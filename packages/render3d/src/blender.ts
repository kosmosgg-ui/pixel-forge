import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ForgeError } from '@pixel-forge/core';

/** Blender 패스 스크립트(packages/render3d/blender/render_passes.py) */
export const PASS_SCRIPT = fileURLToPath(new URL('../blender/render_passes.py', import.meta.url));

/**
 * 방향 이름 → 모델 회전(도, 모델 정면 = 0°가 카메라를 봄). 사용자 승인 P7: POC와 같이 yaw −35° = "se"(3/4 대각),
 * 대각 4방향 = POC의 [-35, 35, 145, -145]. 기본은 se 1방향 + 엔진 좌우 반전(manifest mirror).
 */
export const DIRECTIONS: Readonly<Record<8 | 4 | 1, Readonly<Record<string, number>>>> = {
  8: { s: 0, se: -35, e: -90, ne: -145, n: 180, nw: 145, w: 90, sw: 35 },
  /** 4방향(옥토패스형) 기본값은 8방향 중 눈이 보이는 방향에서 고른다(cli) — 이 표는 눈 정보가 없을 때 */
  4: { se: -35, sw: 35, nw: 145, ne: -145 },
  1: { se: -35 },
};

/** Spec directions(1·4·8 또는 방향 이름 목록) → 이름 → 회전 */
export function yawsOf(d: number | readonly string[]): Record<string, number> {
  if (typeof d !== 'number') return Object.fromEntries(d.map((n) => [n, DIRECTIONS[8][n] ?? 0]));
  return { ...(DIRECTIONS[d === 8 || d === 4 ? d : 1]) };
}

/** rule: prerender.camera — iso = 30° 내려다봄(아이소메트릭 도트), side = 측면 3/4(10°) */
export const ELEVATION = { iso: 30, side: 10 } as const;

export interface PassJob {
  model: string;
  size: [number, number];
  supersample: number;
  height: number;
  elevation: number;
  margin: number;
  bottomGap: number;
  actions: Record<string, string>;
  frames: Record<string, number[]>;
  /** 프레이밍 범위를 잡을 프레임(렌더하는 frames보다 넓을 수 있다 — 전 애니·전 프레임) */
  frameAll: Record<string, number[]>;
  /** 숨길 오브젝트 이름(소품 고르기) */
  hide: string[];
  yaws: Record<string, number>;
  /** 프레이밍 범위를 잡을 방향(없으면 yaws) */
  yawsAll?: Record<string, number>;
}

export interface BlenderOptions {
  /** bpy가 설치된 파이썬(.venv-bpy/bin/python) */
  python: string;
  /** 패스 캐시 루트(.forge-cache/prerender) */
  cacheRoot: string;
}

/** bpy 파이썬 위치: FORGE_BPY_PYTHON, 없으면 <작업 폴더>/.venv-bpy/bin/python */
export function bpyPython(cwd: string, env: Readonly<Record<string, string | undefined>>): string {
  const p = env.FORGE_BPY_PYTHON ?? join(cwd, '.venv-bpy', 'bin', 'python');
  if (!existsSync(p)) {
    throw new ForgeError('render3d.no-bpy', `bpy 파이썬이 없습니다: ${p} — python3.13 -m venv .venv-bpy && .venv-bpy/bin/pip install bpy==5.2.2 (docs/prerender-poc/README.md)`);
  }
  return p;
}

/**
 * Blender를 headless로 실행해 패스를 만든다. 같은 모델 바이트·작업·스크립트면 캐시를 쓴다(렌더가 수십 초라).
 * 반환 = 패스 폴더(passes.json + <anim>_<dir>_<i>_{id,nrm}.png).
 */
export function renderPasses(job: PassJob, o: BlenderOptions): string {
  const key = createHash('sha256').update(readFileSync(job.model)).update(JSON.stringify({ ...job, model: '' })).update(readFileSync(PASS_SCRIPT)).digest('hex').slice(0, 24);
  const dir = join(o.cacheRoot, key);
  if (existsSync(join(dir, 'passes.json'))) return dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const jobPath = join(dir, 'job.json');
  writeFileSync(jobPath, JSON.stringify({ ...job, out: dir }, null, 1));
  // 스크립트 폴더를 import 경로 맨 앞에 두지 않게 -I(표준 모듈 이름 가림 방지)
  const r = spawnSync(o.python, ['-I', PASS_SCRIPT, jobPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout.includes('FORGE_PASSES_DONE')) {
    rmSync(join(dir, 'passes.json'), { force: true });
    const tail = `${r.stderr ?? ''}\n${r.stdout ?? ''}`.trim().split('\n').slice(-6).join(' | ');
    throw new ForgeError('render3d.blender', `Blender 패스 렌더 실패(exit ${r.status ?? 'signal'}): ${tail}`);
  }
  return dir;
}
