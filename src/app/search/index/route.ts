import { buildSearchCatalogue } from "@/search/catalogue";
import manifest from "@/search/embeddings/manifest.json";
import { catalogueDigest } from "@/search/embeddings/records";

// A build-time public artifact, deliberately outside the private /api cache.
export const dynamic = "force-static";

export async function GET() {
  const catalogue = await buildSearchCatalogue();
  return Response.json(
    {
      ...catalogue,
      semanticAvailable:
        Boolean(manifest.selected) &&
        manifest.catalogueSha256 === catalogueDigest(catalogue),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
