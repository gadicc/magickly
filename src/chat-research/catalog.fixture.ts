/** Synthetic bibliography only; never a private roster or source permission. */
import { answerFixture } from "./answer.fixture";
import type { ResearchBookCatalog } from "./catalog";
export function catalogFixture(revision = "a".repeat(64)): ResearchBookCatalog {
  const book = answerFixture().citations.find(
    (c) => c.kind === "pdf_passage",
  )!.book;
  return {
    contract: "magickli-private-research-catalog",
    schema_version: 1,
    catalog_revision: revision,
    books: [1, 2].map((i) => ({
      handle: "book" + i,
      book: { ...structuredClone(book), title: "Synthetic choice " + i },
    })),
  };
}
