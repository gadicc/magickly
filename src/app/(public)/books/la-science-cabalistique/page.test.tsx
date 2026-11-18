import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { textOf } from "../../../../../tests/entityPage";
import BookPage from "./page";

/**
 * The book's front page, where "About this edition" lists the copies the
 * edition is read from and cites. JSX drops a space at a line break before an
 * element, so the list is checked as a reader sees it.
 */
describe("the book's sources", () => {
  const text = textOf(renderToString(<BookPage />));

  it("names the reissue, the 1823 printing and the manuscript copy", () => {
    expect(text).toContain(
      "The base text: the reissue, Google Books ZqgpxTZ43HkC.",
    );
    expect(text).toContain(
      "The 1823 printing, Koninklijke Bibliotheek copy: Google Books qt9SAAAAcAAJ.",
    );
    expect(text).toContain("Ms 5365, an undated handwritten copy");
  });

  it("cites Lenain's own sources with their pages, spaced", () => {
    expect(text).toContain("The Hague 1727, vol. II, pp. 109–110,");
    expect(text).toContain("vol. II part 1, 1653, pp. 271–273,");
    expect(text).toContain("in Hebrew and Latin, and p. 287,");
  });
});
