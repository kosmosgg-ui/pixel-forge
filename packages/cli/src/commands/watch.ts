import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { watch } from 'chokidar';
import { ForgeError } from '@pixel-forge/core';
import { loadProject } from '../io/project.js';
import { applyCommand, type ApplyArgs } from './apply.js';
import { buildCommand } from './build.js';
import { projectDeps } from './deps.js';

export interface WatchEntry {
  spec: string;
  deps: string[];
}

/** 프로젝트 Spec마다 입력 파일 목록 */
export function watchIndex(project: string, cwd: string): WatchEntry[] {
  const dir = join(cwd, 'data', 'specs', project);
  const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.json')).sort();
  if (!specs.length) throw new ForgeError('cli.no-specs', `Spec이 없습니다: ${relative(cwd, dir)}`);
  return specs.map((f) => {
    const spec = join(dir, f);
    return { spec: relative(cwd, spec), deps: projectDeps(spec, loadProject(spec, cwd), cwd) };
  });
}

/** 바뀐 파일을 입력으로 쓰는 캐릭터만(Spec 1개 → 그 캐릭터, 바이블·리그·애니·규칙 → 쓰는 캐릭터 전부) */
export function affectedSpecs(changed: string, index: readonly WatchEntry[]): string[] {
  const full = resolve(changed);
  return index.filter((e) => e.deps.includes(full)).map((e) => e.spec);
}

export type WatchLog = (line: Record<string, unknown>) => void;

/** 변경 1건 처리: 해당 캐릭터만 build(→ --out이 있으면 apply). 실패는 한 줄 JSON으로 남기고 계속 감시 */
export function handleChange(changed: string, index: readonly WatchEntry[], cwd: string, args: ApplyArgs, log: WatchLog): void {
  for (const spec of affectedSpecs(changed, index)) {
    try {
      log(args.out !== undefined ? applyCommand(spec, cwd, args) : buildCommand(spec, cwd));
    } catch (e) {
      log({ ok: false, cmd: 'watch', spec, error: errorOf(e) });
    }
  }
}

const errorOf = (e: unknown) => e instanceof ForgeError
  ? { code: e.code, message: e.message }
  : { code: 'internal', message: e instanceof Error ? e.message : String(e), ...(e instanceof Error && e.stack ? { stack: e.stack } : {}) };

/** forge watch <project>: 입력 파일 변경 시 해당 캐릭터만 build → apply. 프로세스는 감시를 계속한다 */
export function watchCommand(project: string, cwd: string, args: ApplyArgs, log: WatchLog) {
  let index = watchIndex(project, cwd);
  const files = [...new Set(index.flatMap((e) => e.deps))].sort();
  const specDir = join(cwd, 'data', 'specs', project);
  // 편집기가 저장을 여러 번에 나눠 쓰는 동안 반쯤 쓴 JSON을 읽지 않게 쓰기가 멈출 때까지 기다린다.
  // Spec 폴더도 감시해 새 Spec·이름 바꿔 저장(unlink → add)하는 편집기를 잡는다
  const w = watch([...files, specDir], { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
  const onEvent = (path: string) => {
    try {
      index = watchIndex(project, cwd);
      // 바이블·Spec이 다른 리그 등을 가리키게 바뀌면 새 입력 파일도 감시
      const now = [...new Set(index.flatMap((e) => e.deps))];
      const add = now.filter((f) => !files.includes(f));
      if (add.length) { files.push(...add); w.add(add); }
    } catch (e) {
      log({ ok: false, cmd: 'watch', stage: 'index', error: errorOf(e) });
    }
    handleChange(path, index, cwd, args, log);
  };
  w.on('change', onEvent);
  w.on('add', onEvent);
  w.on('error', (e) => log({ ok: false, cmd: 'watch', stage: 'watcher', error: errorOf(e) }));
  return { result: { ok: true as const, cmd: 'watch', project, specs: index.map((e) => e.spec), files: files.length }, close: () => w.close() };
}
