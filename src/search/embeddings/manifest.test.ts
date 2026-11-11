import { expect, it } from "vitest";
import { buildSearchCatalogue } from "@/search/catalogue";
import manifest from "./manifest.json";
import { catalogueDigest } from "./records";

/**
 * The published embeddings belong to one exact catalogue. When the
 * catalogue drifts from `manifest.catalogueSha256`, nothing fails: the
 * search index route reports `semanticAvailable: false` and the store
 * (`store.ts`) returns no vectors, so vector search switches off quietly
 * (plan 076, decision 8). A change to page prose, titles or descriptions
 * needs a paid refresh (`pnpm search:compare`, `pnpm search:publish`,
 * plan 070) in the same branch, or this fails.
 */
it("the catalogue matches the published embeddings", async () => {
  const catalogue = await buildSearchCatalogue();
  expect(catalogueDigest(catalogue)).toBe(manifest.catalogueSha256);
});
