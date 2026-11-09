import { loadSemanticIndex } from "@/search/embeddings/store";
import { respondToSemanticSearch } from "@/search/http";
import { searchSiteByMeaning } from "@/search/semantic";
import { reserveSearchUsage } from "@/search/usage";

export function POST(request: Request) {
  return respondToSemanticSearch(request, {
    available: async () => Boolean(await loadSemanticIndex()),
    reserve: reserveSearchUsage,
    search: searchSiteByMeaning,
  });
}
