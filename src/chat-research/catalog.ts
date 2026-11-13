/** Browser-safe prepared bibliography. A revision is a scope hint, never source permission. */
import * as v from "valibot";
import { parseResearchBook, type ResearchBook } from "./answer";
export const RESEARCH_CATALOG_BYTE_LIMIT = 128 * 1024;
export const RESEARCH_CATALOG_ERROR = "Private book catalog unavailable";
const shape = v.strictObject({
  contract: v.literal("magickli-private-research-catalog"),
  schema_version: v.literal(1),
  catalog_revision: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$(?![\s\S])/)),
  books: v.pipe(
    v.array(v.strictObject({ handle: v.string(), book: v.unknown() })),
    v.minLength(1),
    v.maxLength(32),
  ),
});
/** Qualified books only: no source resources, paths, raw observations or grants. */
export interface ResearchBookCatalog {
  readonly contract: "magickli-private-research-catalog";
  readonly schema_version: 1;
  readonly catalog_revision: string;
  readonly books: readonly {
    readonly handle: string;
    readonly book: ResearchBook;
  }[];
}
const wellFormed = (value: unknown): boolean =>
  typeof value === "string"
    ? value.isWellFormed()
    : Array.isArray(value)
      ? value.every(wellFormed)
      : value && typeof value === "object"
        ? Object.values(value).every(wellFormed)
        : true;
/** Atomically validate the complete owned projection; never truncate bibliographic qualifiers to fit. */
export function parseResearchBookCatalog(input: unknown): ResearchBookCatalog {
  try {
    if (
      new TextEncoder().encode(JSON.stringify(input)).byteLength >
      RESEARCH_CATALOG_BYTE_LIMIT
    )
      throw Error();
    const p = v.parse(shape, input),
      books = p.books.map((b, i) => {
        if (b.handle !== "book" + (i + 1)) throw Error();
        return { handle: b.handle, book: parseResearchBook(b.book) };
      }),
      value = { ...p, books };
    if (
      !wellFormed(value) ||
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
        RESEARCH_CATALOG_BYTE_LIMIT
    )
      throw Error();
    return value;
  } catch {
    throw Error(RESEARCH_CATALOG_ERROR);
  }
}
