import keys, { keyTitle } from "magick-data/enochian/keys";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KeysPage from "./page";

/** The page as the server renders it. */
const html = renderToString(<KeysPage />);

/** The text of each heading of a level, tags and comments dropped. */
const headings = (level: number) =>
  [
    ...html.matchAll(new RegExp(`<h${level}\\b[^>]*>(.*?)</h${level}>`, "g")),
  ].map(([, inner]) =>
    inner
      .replace(/<style\b[^>]*>.*?<\/style>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&#x27;/g, "'"),
  );

describe("/enochian/keys, as the server renders it", () => {
  it("has the Keys, then the text about them under its headings", () => {
    // Under the app bar's h1, each Key is an h2, and so is each part of
    // the text: no level is skipped.
    expect(headings(2)).toEqual([
      ...keys.map((key) => keyTitle(key)),
      "The Enochian Keys",
      "Reading the Keys",
      "Related",
    ]);
    expect(headings(1)).toEqual([]);
    for (const level of [3, 4, 5, 6]) expect(headings(level)).toEqual([]);
    // A heading holds phrasing content: no paragraph inside one.
    expect(html).not.toMatch(/<h2\b(?:(?!<\/h2>).)*<p\b/);
    // The text comes after the Keys themselves.
    expect(html.indexOf("Key 19: the Call of the Thirty Aethyrs")).toBeLessThan(
      html.indexOf('id="keys-text"'),
    );
    expect(html).toMatch(/<section[^>]*aria-labelledby="keys-text"/);
  });

  it("links the dictionary, the tablets, the Oration and the Enochian hub", () => {
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(
      ([, href]) => href,
    );
    for (const href of [
      "/enochian/dictionary",
      "/enochian/tablets",
      "/enochian/oration",
      "/enochian",
    ])
      expect(hrefs).toContain(href);
  });
});
