/** pack 산출물 파일 이름(out/<id>/ 기준) — apply가 복사하고, QA 불합격 시 지우는 목록 */
export const packFiles = (id: string) => [`${id}.png`, `${id}.json`, 'manifest.json'];
