/** Explicit fixed catalog lane; complete validation precedes any DOM update. */
import {
  RESEARCH_PRIVATE_JSON_TIMEOUT_MS,
  requestPrivateResearchMetadata,
} from "./browserPrivateJson";
export const RESEARCH_CATALOG_TIMEOUT_MS = RESEARCH_PRIVATE_JSON_TIMEOUT_MS;
/** No mount/focus calls, retries, generation or browser storage. */
export async function requestResearchBookCatalog(
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
) {
  return requestPrivateResearchMetadata("catalog", signal, requestFetch);
}
