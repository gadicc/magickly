import type { Aethyr, EnochianKey } from "magick-data/enochian/keys";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KEY_ENTRIES } from "./keyEntries";
import {
  keysOf,
  type PageEntries,
  pageAethyrs,
  pageEntries,
  pageKey,
  pageKeys,
} from "./keyPage";
import Keys, {
  type EnochianLang,
  KeyText,
  shownWords,
  WordPanel,
} from "./keys";

/** No dictionary entries. */
const NONE: PageEntries = { entries: {}, parts: {} };

/** The text of server HTML, tags dropped. */
const text = (html: string) =>
  html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

/** A Key with both versions and each kind of Golden Dawn row. */
const KEY: EnochianKey = {
  key: 4,
  sources: [{ work: "casaubon1659", page: 109, leaf: 198 }],
  checked: {
    date: "2026-11-10",
    works: ["casaubon1659", "equinox1912no8"],
    covered: ["enochian", "english", "gd"],
    notCovered: ["a second reading"],
  },
  rows: [
    {
      english: "which is",
      readings: {
        casaubon1659: { word: "DSI" },
        equinox1912no8: { word: "das" },
      },
    },
    {
      english: "and",
      readings: {
        casaubon1659: { word: "OD" },
        equinox1912no8: { marker: "joined" },
      },
    },
    {
      english: "And",
      readings: {
        casaubon1659: { word: "OD" },
        equinox1912no8: { marker: "absent" },
      },
    },
    {
      english: "the sons of men",
      readings: {
        casaubon1659: { word: "NORMOLAP" },
        equinox1912no8: { word: "nor-mo-lapi" },
      },
      uncertain: true,
      note: "a doubtful letter, p.109",
    },
  ],
};

/** Key 19 in small. */
const CALL: EnochianKey = {
  key: 19,
  sources: [{ work: "casaubon1659", page: 201 }],
  checked: { works: [], covered: [], notCovered: ["x"] },
  rows: [
    {
      english: "in the {ordinal} aire",
      readings: {
        casaubon1659: { word: "LIL" },
        equinox1912no8: { word: "LIL" },
      },
      slot: "aethyr",
    },
  ],
};

const AETHYRS: Aethyr[] = [1, 2].map((n) => ({
  n,
  readings: { equinox1912no8: n === 1 ? "LIL" : "ARN" },
  sources: [{ work: "equinox1912no8", page: 125 }],
}));

const renderKeyText = (
  key: EnochianKey,
  lang: EnochianLang,
  version: "dee" | "gd",
  aethyr = 1,
) =>
  text(
    renderToString(
      <KeyText
        words={shownWords(pageKey(key, AETHYRS), version, aethyr)}
        keyNumber={key.key}
        lang={lang}
        enochianFont={false}
        selected={null}
        onSelect={() => {}}
      />,
    ),
  );

describe("/enochian/keys", () => {
  it("shows every Key in the data, in English, with what each was checked against", () => {
    const keys = pageKeys();
    const html = renderToString(
      <Keys
        keys={keys}
        aethyrs={pageAethyrs()}
        entries={pageEntries(KEY_ENTRIES)}
      />,
    );
    const shown = text(html);
    for (const key of keys) expect(shown).toContain(key.title);
    for (const key of keys) expect(shown).toContain(key.checked);
    // The checks are the Keys' own records, not text in the page.
    expect(shown).toMatch(/Checked on \d+ \w+ 20\d\d against/);
    expect(html).toContain('name="keys-language"');
    expect(shown).toContain(keys[0].words[0].english);
  });

  it("offers versions only when the data has the Golden Dawn's", () => {
    const dee = pageKey({
      ...KEY,
      rows: KEY.rows.map((row) => ({
        ...row,
        readings: { casaubon1659: row.readings.casaubon1659 },
      })),
    });
    const without = renderToString(
      <Keys keys={[dee]} aethyrs={[]} entries={NONE} />,
    );
    expect(without).not.toContain('id="keys-version"');
    const withGd = renderToString(
      <Keys keys={[pageKey(KEY)]} aethyrs={[]} entries={NONE} />,
    );
    expect(withGd).toContain('id="keys-version"');
    expect(withGd).toContain('id="keys-version-label"');
    expect(text(withGd)).toContain("Dee's (default)");
  });

  it("titles Key 19 and offers the Aethyrs only when it is there", () => {
    const html = renderToString(
      <Keys
        keys={[pageKey(KEY), pageKey(CALL, AETHYRS)]}
        aethyrs={pageAethyrs(AETHYRS)}
        entries={NONE}
      />,
    );
    const shown = text(html);
    expect(shown).toContain("Key 19: the Call of the Thirty Aethyrs");
    expect(html).toContain('id="aethyr-select"');
    expect(html).toContain('id="aethyr-select-label"');
    expect(shown).toContain("1 LIL");
    expect(shown).toContain("Calls, 19 to 48");
    expect(shown).toContain("in the first aire");
    const without = renderToString(
      <Keys keys={[pageKey(KEY)]} aethyrs={[]} entries={NONE} />,
    );
    expect(without).not.toContain('id="aethyr-select"');
  });

  it("shows each view in Dee's version", () => {
    expect(renderKeyText(KEY, "english", "dee")).toBe(
      " which is and And the sons of men ",
    );
    expect(renderKeyText(KEY, "enochian", "dee")).toBe(" DSI OD OD NORMOLAP ");
    const both = renderKeyText(KEY, "both", "dee");
    expect(both).toContain("4.1 DSI which is");
    expect(both).toContain("4.4 NORMOLAP the sons of men");
  });

  it("shows the Golden Dawn's forms, and says why a row has none", () => {
    // Dee's English in both versions.
    expect(renderKeyText(KEY, "english", "gd")).toBe(
      " which is and And the sons of men ",
    );
    // A joined or absent word is not said.
    expect(renderKeyText(KEY, "enochian", "gd")).toBe(" das nor-mo-lapi ");
    const both = renderKeyText(KEY, "both", "gd");
    expect(both).toContain("4.1 das which is");
    expect(both).toContain("4.2 (joined to the word before) and");
    expect(both).toContain("4.3 (not in this version) And");
  });

  it("shows a word given but not spoken as a gap", () => {
    const unspoken: EnochianKey = {
      ...KEY,
      rows: [
        KEY.rows[0],
        {
          english: "beginning",
          englishSplit: true,
          readings: { casaubon1659: { word: "" } },
          unspoken: true,
          note: "not printed: hummed",
        },
      ],
    };
    expect(renderKeyText(unspoken, "enochian", "dee")).toBe(" DSI ");
    expect(renderKeyText(unspoken, "both", "dee")).toContain(
      "4.2 (not spoken) beginning",
    );
  });

  it("marks an uncertain word, its note in the panel", () => {
    const html = renderToString(
      <KeyText
        words={shownWords(pageKey(KEY), "dee", 1)}
        keyNumber={4}
        lang="enochian"
        enochianFont={false}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('data-uncertain="" title="Uncertain reading"');
    // Notes are the panel's: none in the text, and no style per word.
    expect(html).not.toContain("a doubtful letter");
    expect(html).not.toMatch(/<button[^>]*style=/);
    expect(html.match(/class="key-word"/g)).toHaveLength(4);
    // Each word is a button, so the keyboard reaches it.
    expect(html.match(/<button type="button"/g)).toHaveLength(4);
  });

  it("fills Key 19 for the Aethyr chosen", () => {
    expect(renderKeyText(CALL, "both", "dee", 2)).toContain(
      "19.1 ARN in the second aire",
    );
    expect(renderKeyText(CALL, "enochian", "gd", 2)).toBe(" ARN ");
  });
});

describe("the word panel", () => {
  const words = shownWords(pageKey(KEY), "gd", 1);
  const panel = (index: number, entries = NONE) =>
    text(
      renderToString(
        <WordPanel entries={entries} keyNumber={4} word={words[index]} />,
      ),
    );

  it("says when a word is not in the dictionary", () => {
    expect(panel(0)).toContain("Not in the dictionary.");
    expect(panel(0)).toContain("Golden Dawn: das");
    expect(panel(0)).toContain("Key 4, word 1");
  });

  it("gives both entries of a word found as two", () => {
    const entry = (meaning: string) => ({
      gematria: [],
      pronounciations: [],
      meanings: [{ meaning, source: "x", source2: "", note: "" }],
    });
    const shown = panel(
      3,
      pageEntries({
        NORMOLAP: [
          { key: "NOR", entry: entry("sons") },
          { key: "MOLAP", entry: entry("men") },
        ],
      }),
    );
    expect(shown).toContain("Found as two words: NOR and MOLAP");
    expect(shown).toContain("sons (x)");
    expect(shown).toContain("men (x)");
    expect(shown).not.toContain("Not in the dictionary.");
    expect(shown).toContain("Uncertain reading.");
    expect(shown).toContain("a doubtful letter, p.109");
  });
});

describe("words the page has no Enochian for", () => {
  /** A Key with a row not yet read, and one Casaubon's print lost. */
  const PARTLY: EnochianKey = {
    key: 14,
    sources: [{ work: "casaubon1659", page: 133 }],
    checked: { works: [], covered: [], notCovered: ["x"] },
    rows: [
      { english: "O you sons of fury", readings: {} },
      {
        english: "the daughters",
        readings: { equinox1912no8: { word: "Noromi baghie" } },
        notInCasaubon: true,
        note: "lost in Casaubon's print",
      },
    ],
  };

  it("shows a placeholder, not an empty button, for a row with none", () => {
    const html = renderToString(
      <KeyText
        words={shownWords(pageKey(PARTLY), "dee", 1)}
        keyNumber={14}
        lang="both"
        enochianFont={false}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(text(html)).toContain("14.1 (no Enochian yet) O you sons of fury");
    // One button, the word that has a form; none left empty.
    expect(html.match(/<button[^>]*>/g)).toHaveLength(1);
    expect(html).not.toMatch(/<button[^>]*><\/button>/);
  });

  it("marks Crowley's form standing in for Casaubon's", () => {
    const [, lost] = shownWords(pageKey(PARTLY), "dee", 1);
    expect(lost).toMatchObject({
      word: "Noromi baghie",
      lookup: "NOROMIBAGHIE",
      from: "equinox1912no8",
    });
    const shown = text(
      renderToString(<WordPanel entries={NONE} keyNumber={14} word={lost} />),
    );
    expect(shown).toContain(
      "Crowley's form, from The Equinox: not in Casaubon's print.",
    );
    expect(shown).toContain("lost in Casaubon's print");
  });

  it("shows Crowley's form in italic where it stands in, in each view", () => {
    const render = (lang: EnochianLang, version: "dee" | "gd") =>
      renderToString(
        <KeyText
          words={shownWords(pageKey(PARTLY), version, 1)}
          keyNumber={14}
          lang={lang}
          enochianFont={false}
          selected={null}
          onSelect={() => {}}
        />,
      );
    const marked =
      /<button[^>]*data-crowley=""[^>]*title="Crowley&#x27;s form: not in Casaubon&#x27;s print"[^>]*>Noromi baghie</;
    expect(render("enochian", "dee")).toMatch(marked);
    expect(render("both", "dee")).toMatch(marked);
    // The English is Casaubon's, so nothing there is Crowley's.
    expect(render("english", "dee")).not.toContain("data-crowley");
  });
});

describe("Key 19's words by Aethyr", () => {
  it("replaces a word whole, so nothing of the first Aethyr's stays", () => {
    // The first Aethyr's name is Crowley's (`from`); the second's is Dee's.
    const lost: EnochianKey = {
      ...CALL,
      rows: [
        {
          english: "in the {ordinal} aire",
          readings: { equinox1912no8: { word: "LIL" } },
          notInCasaubon: true,
          slot: "aethyr",
        },
      ],
    };
    const table: Aethyr[] = [
      { n: 1, readings: { equinox1912no8: "LIL" }, sources: [] },
      {
        n: 2,
        readings: { casaubon1659: "Arn", equinox1912no8: "ARN" },
        sources: [],
      },
    ];
    const page = pageKey(
      {
        ...lost,
        rows: [
          ...lost.rows,
          { english: "are", readings: { casaubon1659: { word: "CHIS" } } },
        ],
      },
      table,
    );
    // Only the words that change are sent.
    expect(Object.keys(page.aethyrs?.[2].dee ?? {})).toEqual(["0"]);
    expect(page.words[0].from).toBe("equinox1912no8");
    // Whole, and without a lookup that is the word itself.
    expect(page.aethyrs?.[2].dee[0]).toEqual({
      word: "ARN",
      english: "in the second aire",
    });
    const [second] = shownWords(page, "dee", 2);
    expect(second.word).toBe("ARN");
    expect(second.from).toBeUndefined();
  });
});

describe("what the page sends", () => {
  it("leaves out a lookup that is the word, and empty fields", () => {
    const page = pageKey(KEY);
    expect(page.words[0]).toEqual({ word: "DSI", english: "which is" });
    // A Golden Dawn word without a form is its marker alone.
    expect(page.gd?.[1]).toEqual({ marker: "joined" });
    // Dee's note is not sent again with the Golden Dawn's word.
    expect(page.words[3].note).toBe("a doubtful letter, p.109");
    expect(page.gd?.[3]).toEqual({ word: "nor-mo-lapi" });
  });

  it("sends each dictionary entry once, with what the panel shows", () => {
    const entry = {
      gematria: [],
      pronounciations: [{ pronounciation: "vrbs", source: "x" }],
      meanings: [{ meaning: "beautiful", source: "x", source2: "", note: "" }],
    };
    const sent = pageEntries({
      URBS: [{ key: "VRBS", entry }],
      VRBS: [{ key: "VRBS", entry }],
      OL: [{ key: "OL", entry }],
      NORMOLAP: [
        { key: "NOR", entry },
        { key: "MOLAP", entry },
      ],
    });
    expect(Object.keys(sent.entries).sort()).toEqual([
      "MOLAP",
      "NOR",
      "OL",
      "VRBS",
    ]);
    expect(sent.entries.OL).toEqual({
      pronunciation: "vrbs",
      meanings: [{ meaning: "beautiful", source: "x" }],
    });
    expect(sent.parts).toEqual({
      URBS: ["VRBS"],
      NORMOLAP: ["NOR", "MOLAP"],
    });
    expect(keysOf(sent, "URBS")).toEqual(["VRBS"]);
    expect(keysOf(sent, "OL")).toEqual(["OL"]);
    expect(keysOf(sent, "NONE")).toBeUndefined();
  });
});
