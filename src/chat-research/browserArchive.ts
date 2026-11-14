/** Explicit bounded saved-answer metadata. Never sends previous answers as model history. */
import { requestPrivateResearchMetadata } from "./browserPrivateJson";
/** One fixed private POST; complete canonical metadata is validated before display. */
export async function requestResearchAnswerArchive(
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
) {
  return requestPrivateResearchMetadata("archive", signal, requestFetch);
}
