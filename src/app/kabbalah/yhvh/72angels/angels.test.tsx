import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SeventyTwoAngels from "./angels";

/**
 * The note on sources links the reissue's folded plate, which opens in the
 * lightbox and, without JavaScript, goes to the page on Google Books.
 */
describe("the 72 angels page's note on sources", () => {
  it("links the reissue's plate to its mirrored page", () => {
    const html = renderToString(<SeventyTwoAngels />);
    expect(html).toContain(
      '<a href="https://books.google.com/books?id=ZqgpxTZ43HkC&amp;pg=PA25" aria-haspopup="dialog">fold-out leaf</a>',
    );
  });
});
