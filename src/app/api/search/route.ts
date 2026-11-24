import { SEARCH_CLIENT } from "@/limits/policies";
import { requestClientSubject } from "@/limits/request";
import { loadSemanticIndex } from "@/search/embeddings/store";
import { respondToSemanticSearch } from "@/search/http";
import { searchSiteByMeaning } from "@/search/semantic";
import { reserveSearchUsage } from "@/search/usage";

export function POST(request: Request) {
  return respondToSemanticSearch(request, {
    available: async () => Boolean(await loadSemanticIndex()),
    reserve: () => {
      const now = new Date();
      return reserveSearchUsage(
        requestClientSubject(request, SEARCH_CLIENT, now),
        now,
      );
    },
    search: searchSiteByMeaning,
  });
}
