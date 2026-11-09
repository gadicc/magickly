import { embeddingInput } from "./embeddings/profiles";
import { embedSearchInputs } from "./embeddings/provider";
import { fuseSearchResults, rankVectors } from "./embeddings/rank";
import { loadSemanticIndex } from "./embeddings/store";

/** Shared by HTTP search and a future MagickGPT searchSite tool. */
export async function searchSiteByMeaning(query: string, signal: AbortSignal) {
  const index = await loadSemanticIndex();
  if (!index) throw new Error("Search embeddings are not current");
  const { embeddings } = await embedSearchInputs(
    index.profile,
    [embeddingInput(index.profile, "query", query)],
    signal,
  );
  const dense = rankVectors(
    index.records,
    index.vectors,
    embeddings[0],
    query,
    40,
  );
  const lexical = index.lexical.search(query, 40);
  return fuseSearchResults(lexical, dense);
}
