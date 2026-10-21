export const EXIT_OK = 0;
export const EXIT_VALIDATION = 1;
export const EXIT_QA_FAILED = 2;
export const EXIT_INTERNAL = 3;

export type ExitCode = typeof EXIT_OK | typeof EXIT_VALIDATION | typeof EXIT_QA_FAILED | typeof EXIT_INTERNAL;

// 모든 실패를 한 타입으로 모아 CLI가 code만 보고 종료 코드를 고르게 한다
export class ForgeError extends Error {
  readonly code: string;
  readonly detail: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'ForgeError';
    this.code = code;
    this.detail = detail;
  }
}
