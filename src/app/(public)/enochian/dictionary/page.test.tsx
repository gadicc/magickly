import dictionary from "magick-data/enochian/dictionary";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DictionaryPage, { metadata } from "./page";

/** The page as the server renders it, which is what search engines read. */
const html = renderToString(<DictionaryPage />);

describe("/enochian/dictionary, as the server renders it (plan 074)", () => {
  it("lists every word, each with a meaning", () => {
    const rows = html.match(/role="option"/g) ?? [];
    expect(rows.length).toBe(Object.keys(dictionary).length);
    // A row: the word, its script, then its meaning and source.
    expect(html).toMatch(
      /<span class="dict-word">OLPRT<\/span>.*?<span class="dict-meaning">light<span class="dict-source"> <abbr title="[^"]*Schueler[^"]*">EMPM<\/abbr><\/span>/,
    );
  });

  it("says when a word's meaning is unknown", () => {
    expect(html).toContain("dict-meaning dict-unknown");
  });

  it("opens no entry: the URL is read in the browser", () => {
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toMatch(/class="[^"]*dict-about-off/);
  });

  it("sends only its origin as the referrer, never the query", () => {
    // The query is in the address (?q=); Next writes this as
    // <meta name="referrer" content="strict-origin">.
    expect(metadata.referrer).toBe("strict-origin");
    expect(metadata.alternates?.canonical).toBe("/enochian/dictionary");
  });

  it("has the text once, in the pane, before the list", () => {
    expect(html.match(/How to search/g)).toHaveLength(1);
    const about = html.indexOf('class="dict-about"');
    expect(about).toBeGreaterThan(html.indexOf('class="dict-pane"'));
    expect(html.indexOf("How to search")).toBeGreaterThan(about);
    expect(html.indexOf('role="listbox"')).toBeGreaterThan(
      html.indexOf("How to search"),
    );
    // Each book's title follows its bracket, with no space between.
    expect(html).toContain("Aaron Leitch (<i>The Angelical Language</i>");
    expect(html).toContain("Laycock (<i>The Complete Enochian Dictionary</i>");
  });
});
