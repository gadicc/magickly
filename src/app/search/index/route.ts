import { buildSearchCatalogue } from "@/search/catalogue";
import { semanticAvailable } from "@/search/embeddings/store";

// A build-time public artifact, deliberately outside the private /api cache.
export const dynamic = "force-static";

export async function GET() {
  const catalogue = await buildSearchCatalogue();
  return Response.json(
    {
      ...catalogue,
      // The coverage rule /api/search applies (plan 087): some record has
      // a row for the selected profile.
      semanticAvailable: semanticAvailable(catalogue),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
