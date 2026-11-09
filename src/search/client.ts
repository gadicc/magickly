import { createSearchEngine } from "./engine";
import type { SearchCatalogue } from "./types";

const INDEX = "/search/index";
const CACHE = "magickli-public-search-v1";
export type LoadedSearchEngine = ReturnType<typeof createSearchEngine> & {
  semanticAvailable: boolean;
};
let loading: Promise<LoadedSearchEngine> | undefined;

/** Loads on first opening, revalidates online, and keeps one public offline copy. */
export function loadSearchEngine() {
  if (loading) return loading;
  loading = (async () => {
    let response: Response;
    try {
      response = await fetch(INDEX, { credentials: "omit" });
      if (!response.ok) throw new Error("Search index unavailable");
      // Cache failure must not prevent searching in browsers with storage disabled.
      if (typeof caches !== "undefined") {
        const copy = response.clone();
        void caches
          .open(CACHE)
          .then((cache) => cache.put(INDEX, copy))
          .catch(() => {});
      }
    } catch {
      const saved =
        typeof caches !== "undefined"
          ? await caches
              .open(CACHE)
              .then((cache) => cache.match(INDEX))
              .catch(() => undefined)
          : undefined;
      if (!saved) throw new Error("Connect to load search, then try again.");
      response = saved;
    }
    const catalogue = (await response.json()) as SearchCatalogue & {
      semanticAvailable?: boolean;
    };
    if (catalogue.version !== 1 || !Array.isArray(catalogue.documents))
      throw new Error("Search needs to be refreshed. Try again.");
    return {
      ...createSearchEngine(catalogue),
      semanticAvailable: catalogue.semanticAvailable === true,
    };
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
