import { FORGE_VERSION, ForgeError } from '@pixel-forge/core';
import { applyCommand } from './commands/apply.js';
import { buildAllCommand, buildCommand } from './commands/build.js';
import { crowdCommand } from './commands/crowd.js';
import { packCommand } from './commands/pack.js';
import { paletteCommand } from './commands/palette.js';
import { qaCommand } from './commands/qa.js';
import { refAnalyzeCommand, refCompareCommand } from './commands/ref.js';
import { renderCommand } from './commands/render.js';
import { reviewScoreCommand } from './commands/review-gate.js';
import { reviewCommand } from './commands/review.js';
import { compareCommand } from './commands/compare.js';
import { sceneCommand } from './commands/scene.js';
import { lineupCommand } from './commands/lineup.js';
import { importCommand, probeCommand } from './commands/import.js';
import { validateCommand } from './commands/validate.js';
import { watchCommand } from './commands/watch.js';

export interface RunInput {
  version: boolean;
  positionals: string[];
  cwd: string;
  /** --anim a,b */
  anim?: string;
  /** render --sheet k (스튜디오 시트 배율) */
  sheet?: string;
  /** --count n */
  count?: string;
  /** --seed n */
  seed?: string;
  /** --format aseprite-json */
  format?: string;
  /** --target <adapter> */
  target?: string;
  /** --out <dir> */
  out?: string;
  /** ref analyze: --source <url> --license <id> --id <id> */
  source?: string;
  license?: string;
  id?: string;
  /** review-score: --score n --note text */
  score?: string;
  note?: string;
  /** review-score: 기준별 관찰 JSON */
  obs?: string;
  /** import --probe <png> */
  probe?: boolean;
  /** apply·watch: 검수 확인 생략 */
  skipReview?: boolean;
}

function intOption(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new ForgeError('cli.args', `--${name}는 0 이상의 정수여야 합니다: ${raw}`);
  return n;
}

export type RunResult = { ok: true; cmd: string } & Record<string, unknown>;

export function run(input: RunInput): RunResult {
  if (input.version || input.positionals[0] === 'version') {
    return { ok: true, cmd: 'version', version: FORGE_VERSION };
  }
  const [cmd, arg] = input.positionals;
  if (cmd === undefined) throw new ForgeError('cli.no-command', '명령이 없습니다. 예: forge --version');
  const need = (usage: string): string => {
    if (arg === undefined) throw new ForgeError('cli.args', `사용법: forge ${cmd} ${usage}`);
    return arg;
  };
  if (cmd === 'palette') return paletteCommand(need('<bible id 또는 경로>'), input.cwd);
  if (cmd === 'validate') return validateCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'render') return renderCommand(need('<spec 경로> [--anim a,b] [--sheet 8]'), input.cwd, input.anim ? input.anim.split(',').filter(Boolean) : [], input.sheet === undefined ? undefined : Number(input.sheet));
  if (cmd === 'crowd') return crowdCommand(need('<프로젝트 이름> [--count 50] [--seed 1]'), input.cwd, intOption('count', input.count, 50), intOption('seed', input.seed, 1));
  if (cmd === 'lineup') return lineupCommand(need('<out/….png> <a.png|b.spec.json[#anim_dir_n]> ... [--sheet 4]'), input.positionals.slice(2), input.cwd, input.sheet === undefined ? 4 : Number(input.sheet));
  if (cmd === 'scene') return sceneCommand(need('<data/scenes/<이름>.scene.json> [--sheet 2]'), input.cwd, input.sheet === undefined ? undefined : Number(input.sheet));
  if (cmd === 'compare') return compareCommand(need('<out/….png> <a.spec.json,b.spec.json> ... [--sheet 8]'), input.positionals.slice(2), input.cwd, input.sheet === undefined ? undefined : Number(input.sheet));
  if (cmd === 'review') return reviewCommand(need('<프로젝트 이름>'), input.cwd);
  if (cmd === 'review-score') return reviewScoreCommand(need('<spec 경로> --score <0~24> --obs <기준별 관찰 JSON> [--note 문장] [--sheet 4]'), input.cwd, Number(input.score), input.obs, input.note, input.sheet === undefined ? 4 : Number(input.sheet));
  if (cmd === 'qa') return qaCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'pack') return packCommand(need('<spec 경로> [--format aseprite-json]'), input.cwd, input.format);
  if (cmd === 'import') return input.probe ? probeCommand(need('--probe <png>'), input.cwd) : importCommand(need('<spec 경로> | --probe <png>'), input.cwd);
  if (cmd === 'build') return buildCommand(need('<spec 경로>'), input.cwd);
  if (cmd === 'apply') return applyCommand(need('<spec 경로> --target dir --out <dir>'), input.cwd, { ...(input.target ? { target: input.target } : {}), ...(input.out ? { out: input.out } : {}), ...(input.skipReview ? { skipReview: true } : {}) });
  if (cmd === 'watch') {
    // 감시는 계속 돈다: 시작 요약을 반환하고, 이후 빌드 결과는 한 줄 JSON씩 stdout에
    const log = (line: Record<string, unknown>) => process.stdout.write(JSON.stringify(line) + '\n');
    return watchCommand(need('<프로젝트 이름> [--target dir --out <dir>]'), input.cwd, { ...(input.target ? { target: input.target } : {}), ...(input.out ? { out: input.out } : {}), ...(input.skipReview ? { skipReview: true } : {}) }, log).result;
  }
  if (cmd === 'ref') {
    const [, sub, a1, a2] = input.positionals;
    if (sub === 'analyze' && a1) return refAnalyzeCommand(a1, input.cwd, { ...(input.source ? { source: input.source } : {}), ...(input.license ? { license: input.license } : {}), ...(input.id ? { id: input.id } : {}) });
    if (sub === 'compare' && a1 && a2) return refCompareCommand(a1, a2, input.cwd);
    throw new ForgeError('cli.args', '사용법: forge ref analyze <png> --source <url> --license <id> [--id <id>] | forge ref compare <spec> <ref.json>');
  }
  if (cmd === 'build-all') return buildAllCommand(need('<프로젝트 이름>'), input.cwd);
  throw new ForgeError('cli.unknown-command', `알 수 없는 명령: ${cmd}`);
}
