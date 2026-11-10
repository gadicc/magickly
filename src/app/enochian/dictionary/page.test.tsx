import dictionary from "magick-data/enochian/dictionary";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DictionaryPage from "./page";

/** The page as the server renders it, which is what search engines read. */
const html = renderToString(<DictionaryPage />);

describe("/enochian/dictionary, as the server renders it (plan 074)", () => {
  it("lists every word, each with a meaning", () => {
    const rows = html.match(/role="option"/g) ?? [];
    expect(rows.length).toBe(Object.keys(dictionary).length);
    // A row: the word, its script, then its meaning and source.
    expect(html).toMatch(
      /<span class="dict-word">OLPRT<\/span>.*?<span class="dict-meaning">light<span class="dict-source">EMPM<\/span>/,
    );
  });

  it("says when a word's meaning is unknown", () => {
    expect(html).toContain("dict-meaning dict-unknown");
  });

  it("opens no entry: the URL is read in the browser", () => {
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain("Choose a word to see its entry.");
  });

  it("has the text below the tool", () => {
    expect(html).toContain("How to search");
  });
});
