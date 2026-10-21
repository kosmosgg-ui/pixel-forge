/** apply가 넘기는 산출물: pack 결과 파일들(절대 경로) */
export interface Artifacts {
  id: string;
  files: readonly string[];
}

export interface ApplyOptions {
  /** 대상 폴더(절대 경로, resolveInside를 거친 값) */
  out: string;
}

export interface ApplyResult {
  /** 대상 폴더 안 상대 경로 */
  written: string[];
  unchanged: string[];
  dest: string;
}

/** 게임 연동 어댑터. 엔진별 어댑터는 이 인터페이스를 구현한 파일 하나로 추가한다 */
export interface Adapter {
  id: string;
  apply(a: Artifacts, o: ApplyOptions): ApplyResult;
}
