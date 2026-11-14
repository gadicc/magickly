import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lookupRuleNotes } from "./ruleNotes.server.ts";
import { LOOKUP_RULES, parseRuleNotes } from "./ruleNotes.ts";

const source = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");

describe("the notes a rule chip opens (plan 081, decision 18)", () => {
  it("are every rule the lookup can name, and no others", () => {
    // Each rule the lookup gives is a literal in its code: the chips'
    // tables (toEnochian.ts) and the join rule's (joins.ts).
    const named = new Set(
      ["./toEnochian.ts", "./joins.ts", "./toEnglish.ts"].flatMap((file) =>
        [...source(file).matchAll(/"(G\d+)"/g)].map(([, id]) => id),
      ),
    );
    expect([...LOOKUP_RULES].sort()).toEqual([...named].sort());
  });

  it("are read from grammar.md, each with its title, text and sources", () => {
    const notes = lookupRuleNotes();
    expect(Object.keys(notes)).toEqual([...LOOKUP_RULES]);
    for (const id of LOOKUP_RULES) {
      const note = notes[id];
      expect(note?.title, id).toBeTruthy();
      expect(note?.text.length, id).toBeGreaterThan(40);
      expect(note?.sources.length, id).toBeGreaterThan(0);
      // Plain text: no Markdown marks and no example lines.
      expect(note?.text, id).not.toMatch(/[*`<>]|Example:|Evidence:/);
    }
    expect(notes.G4).toEqual({
      id: "G4",
      title: "There are no articles",
      text: 'Enochian has no word for "the", "a" or "an". Whenever Dee\'s English has one, it comes with the noun\'s gloss. Leave articles out when translating into Enochian.',
      sources: [
        "Laycock (Weiser, 2001), p. 43",
        'Leitch vol. II, ch. 1, "Rarities", pp. 19–22, and "Tips on translating", p. 533',
      ],
    });
  });

  it("parses a note's emphasis as plain text and stops at a section", () => {
    const notes = parseRuleNotes(
      [
        "### G1. The *first*",
        "Some `code` and *emphasis*,",
        "over two lines.",
        "- Sources: One; Two",
        "- Example: Key 1.1 OL = I",
        "## Next section",
        "Not part of it.",
      ].join("\n"),
      ["G1", "G2"],
    );
    expect(notes).toEqual({
      G1: {
        id: "G1",
        title: "The first",
        text: "Some code and emphasis, over two lines.",
        sources: ["One", "Two"],
      },
    });
  });
});
