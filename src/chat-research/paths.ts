/** Public routing constants only; no corpus, account or runtime configuration. */
export const RESEARCH_PAGE_PATH = "/chat/research";
export const RESEARCH_API_PATH = "/chat/research/api";
export const RESEARCH_ARCHIVE_API_PATH = "/chat/research/answers/list";
export const RESEARCH_CATALOG_API_PATH = "/chat/research/catalog";
export const RESEARCH_READ_BODY_BYTE_LIMIT = 128;
export const RESEARCH_READ_API_PATH = "/chat/research/answers/read";
/** Decode the fixed ASCII route only: invalid Unicode/percent suffixes must not turn a research descendant public. */
export function isResearchPath(pathname: string): boolean {
  const path = pathname
    .replace(/%([a-f0-9]{2})/gi, (raw, byte: string) => {
      const code = Number.parseInt(byte, 16);
      return code < 128 ? String.fromCharCode(code) : raw;
    })
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .toLowerCase();
  return (
    path === RESEARCH_PAGE_PATH || path.startsWith(RESEARCH_PAGE_PATH + "/")
  );
}
