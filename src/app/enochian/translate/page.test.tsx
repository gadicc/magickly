import dictionary from "magick-data/enochian/dictionary";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FIGURES from "./figures.json";
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
    expect(html).toContain(`forms ${share(coverage.forms, coverage.words)}`);
    expect(html).toContain(
      `rule chips ${share(coverage.chips, coverage.words)}`,
    );
    expect(html).toContain(`gaps ${share(coverage.gaps, coverage.words)}`);
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

  it("has the text below the tool", () => {
    expect(html).toContain("About the translator");
    expect(html).toContain(
      `our dictionary of ${Object.keys(dictionary).length.toLocaleString("en")} words`,
    );
    expect(html).toContain("English into Enochian");
    expect(html).toContain("Your text stays with you");
  });
});
