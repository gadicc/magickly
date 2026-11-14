import { expect, it } from "vitest";
import {
  parseResearchBookCatalog,
  RESEARCH_CATALOG_BYTE_LIMIT,
  RESEARCH_CATALOG_ERROR,
} from "./catalog";
import { catalogFixture } from "./catalog.fixture";

it("copies all qualified fields without exposing source resources or granting authority", () => {
  const input = catalogFixture(),
    value = parseResearchBookCatalog(input);
  input.books[0].book.title = "Changed caller";
  input.books[0].book.contributors[0].name = "Changed caller";
  expect(value.books[0].book.title).toBe("Synthetic choice 1");
  expect(value.books[0].book.contributors[0].name).toBe("Synthetic Author");
  expect(value.books[0].book).toMatchObject({
    edition: "Second edition",
    dates: [{ kind: "publication", year: 2020 }],
  });
});
it.each([
  "unknown",
  "path",
  "book-resource",
  "duplicate",
  "gap",
  "newline-revision",
  "absent",
  "count",
  "empty",
  "book",
  "unicode",
])("rejects invalid catalog %s", (kind) => {
  const input = JSON.parse(JSON.stringify(catalogFixture()));
  if (kind === "unknown") input.user_id = "private";
  if (kind === "path") input.file_path = "private";
  if (kind === "book-resource")
    input.books[0].book.url = "https://untrusted.example";
  if (kind === "duplicate") input.books[1].handle = "book1";
  if (kind === "gap") input.books[0].handle = "book2";
  if (kind === "newline-revision") input.catalog_revision += "\n";
  if (kind === "absent") delete input.catalog_revision;
  if (kind === "count")
    input.books = Array.from({ length: 33 }, (_, i) => ({
      ...input.books[0],
      handle: "book" + (i + 1),
    }));
  if (kind === "empty") input.books = [];
  if (kind === "book") input.books[0].book.edition = " ";
  if (kind === "unicode") input.books[0].book.title = "\ud800";
  expect(() => parseResearchBookCatalog(input)).toThrow(RESEARCH_CATALOG_ERROR);
});
it("bounds the original and normalized payload without truncating otherwise qualified books", () => {
  const input = JSON.parse(JSON.stringify(catalogFixture()));
  input.books[0].book.notes = ["x".repeat(RESEARCH_CATALOG_BYTE_LIMIT)];
  expect(() => parseResearchBookCatalog(input)).toThrow(RESEARCH_CATALOG_ERROR);
  const hidden = JSON.parse(JSON.stringify(catalogFixture()));
  hidden.books = Array.from({ length: 32 }, (_, i) => ({
    handle: "book" + (i + 1),
    book: { ...hidden.books[0].book, notes: Array(32).fill("x".repeat(512)) },
  }));
  Object.defineProperty(hidden, "toJSON", {
    value: () => ({}),
    enumerable: false,
  });
  expect(() => parseResearchBookCatalog(hidden)).toThrow(
    RESEARCH_CATALOG_ERROR,
  );
});
