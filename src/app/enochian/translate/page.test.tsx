import dictionary from "magick-data/enochian/dictionary";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FIGURES from "./figures.json";
import { shares } from "./labels";
import TranslatePage from "./page";

/** The page as the server renders it, which is what search engines read. */
// React marks where text meets an expression; they are not the page.
const html = renderToString(<TranslatePage />).replace(/<!-- -->/g, "");

describe("/enochian/translate, as the server renders it (plan 081)", () => {
  it("is the empty tool: two boxes and no results", () => {
    expect(html).toContain('aria-label="English or Latin letters"');
    expect(html).toContain('aria-label="Enochian, right to left"');
    expect(html).toContain(
      "Type a word or a sentence, in English or in Enochian.",
    );
    // The text is read from the fragment in the browser.
    expect(html).not.toContain('class="tr-tile');
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain("Choose a word to see its entry.");
  });

  it("shows the figures with their date, labelled for what they are", () => {
    const { coverage, selfCheck, date } = FIGURES;
    const share = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(html).toContain(`Measured ${day}`);
    // The three shares add up to 100 (largest remainder).
    const [forms, chips, gaps] = shares(
      [coverage.forms, coverage.chips, coverage.gaps],
      coverage.words,
    );
    expect(forms + chips + gaps).toBe(100);
    expect(html).toContain(`forms ${forms}%`);
    expect(html).toContain(`rule chips ${chips}%`);
    expect(html).toContain(`gaps ${gaps}%`);
    expect(html).toContain(`of ${coverage.words} words`);
    for (const [kind, counts] of Object.entries(coverage.byKind))
      expect(html).toContain(
        `${kind} ${counts.gapFree} of ${counts.sentences}`,
      );
    expect(html).toContain("A self-consistency check");
    expect(html).toContain(
      `${selfCheck.found} of ${selfCheck.rows.toLocaleString("en")} words (${share(selfCheck.found, selfCheck.rows)})`,
    );
    expect(html).not.toMatch(/margin of error|±/);
  });

  it("rounds the coverage shares to sum to 100, by largest remainder", () => {
    // 280, 115 and 227 of 622 are 45.02%, 18.49% and 36.50%: rounded each
    // alone they show 99%.
    expect(shares([280, 115, 227], 622)).toEqual([45, 18, 37]);
    expect(shares([1, 1, 1], 3)).toEqual([34, 33, 33]);
    expect(shares([0, 0, 0], 0)).toEqual([0, 0, 0]);
    expect(shares([2, 0, 0], 2)).toEqual([100, 0, 0]);
  });

  it("has the text below the tool", () => {
    expect(html).toContain("About the translator");
    expect(html).toContain(
      `our dictionary of ${Object.keys(dictionary).length.toLocaleString("en")} words`,
    );
    expect(html).toContain("English into Enochian");
    expect(html).toContain("Your text stays with you");
  });
});
