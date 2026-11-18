import { notesByPage } from "magick-data/kabbalah/lenain/notes";
import { divisions, leavesOf } from "magick-data/kabbalah/lenain/volume";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { textOf } from "../../../../tests/entityPage";
import Reading from "./Reading";

/**
 * The reading edition's editorial notes, where they cite the other copies.
 * The witnesses are links to the page each was read from, so a reader can
 * check the 1823 printing against the reissue without taking our word.
 */

function chapter(slug: string) {
  const division = divisions.find((entry) => entry.slug === slug);
  if (!division) throw new Error(`No division ${slug}`);
  return renderToString(
    <Reading
      leaves={leavesOf(division)}
      notesByPage={notesByPage()}
      label={division.title}
    />,
  );
}

describe("the reading edition's notes", () => {
  it("link the 1823 printing and the manuscript copy", () => {
    const html = chapter("chapitre-6");
    // Ariel, the 46th: the reissue's "36e" is the 1823 printing's "46e".
    expect(html).toContain(
      '<a href="https://books.google.com/books?id=qt9SAAAAcAAJ&amp;pg=PA76" rel="noopener">1823 printing, p. 76</a>',
    );
    expect(html).toContain(
      '<a href="https://archive.org/details/BIUSante_ms05365/page/n83/mode/1up" rel="noopener">Ms 5365, leaf n83</a>',
    );
  });

  it("set the Hebrew in a note's reason right to left", () => {
    const html = chapter("chapitre-6");
    expect(html).toMatch(
      /reads “<span lang="he" dir="rtl"[^>]*>אניאל<\/span>”/,
    );
  });

  it("say which hour is used where none is printed", () => {
    expect(textOf(chapter("chapitre-6"))).toContain(
      "Genius 8, invocationcorrection · 2:20 — Neither the 1823 printing (p. 50)",
    );
  });
});
