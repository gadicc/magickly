import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import {
  HINT_TABLE_FORMAT,
  HINT_TABLE_NOTICE,
  type HintTable,
  tableText,
} from "../../src/app/enochian/translate/hints/format.ts";
import { buildKeysTable } from "../../src/app/enochian/translate/keysTable.ts";
import {
  createTranslator,
  glossOptions,
} from "../../src/app/enochian/translate/lookup.ts";
import { fold } from "../../src/app/enochian/translate/lookupData.ts";
import {
  DENYLIST,
  englishOnly,
  glossHash,
  HUB_FORMS,
  hintGlosses,
  isEditorialGloss,
  isGrammarGloss,
  isNameGloss,
  MAX_FORMS,
} from "./glosses.ts";
import { HINT_RECIPE } from "./recipe.ts";
import { HINT_TABLE_FILE, readVerdicts, score } from "./table.ts";
import { needsHint } from "./words.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const translator = createTranslator(buildKeysTable(), dictionary);
const glosses = hintGlosses(translator);
const text = readFileSync(path.join(root, HINT_TABLE_FILE), "utf8");
const table = JSON.parse(text) as HintTable;

describe("which words need a hint (plan 081, S11)", () => {
  it("keeps a content word the lookup shows as a gap", () => {
    for (const word of ["dawn", "master", "tongue", "beautiful"])
      expect(needsHint(translator, word), word).toBe(true);
  });

  it("drops a word with a form, an inflection of one, grammar and old spellings", () => {
    // SUNRISE is RNAH; "kings" and "came" fold to KING and "come"; "could"
    // and "her" are grammar; "shew" is read as "show".
    for (const word of [
      "sunrise",
      "kings",
      "came",
      "house",
      "could",
      "her",
      "the",
      "shew",
    ])
      expect(needsHint(translator, word), word).toBe(false);
  });
});

describe("the glosses a word can be close to", () => {
  it("are our exact glosses, without names, grammar, notes or hub words, each once", () => {
    expect(glosses.length).toBeGreaterThan(1000);
    const texts = glosses.map((one) => one.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toEqual([...texts].sort());
    for (const one of glosses) {
      expect(isNameGloss(one.text), one.text).toBe(false);
      expect(isGrammarGloss(one.text), one.text).toBe(false);
      expect(isEditorialGloss(one.shown, one.text), one.shown).toBe(false);
      expect(DENYLIST.has(one.text), one.text).toBe(false);
      expect(one.forms.length).toBeGreaterThan(0);
      expect(one.forms.length).toBeLessThanOrEqual(MAX_FORMS);
      for (const form of one.forms)
        expect(HUB_FORMS.has(fold(form))).toBe(false);
      // The page finds the forms again from the wording it shows.
      const found = glossOptions(translator.lookup, one.shown).map(
        (option) => option.form,
      );
      for (const form of one.forms) expect(found, one.shown).toContain(form);
    }
    const by = (text: string) => glosses.find((one) => one.text === text);
    expect(by("sunrise")).toEqual({
      text: "sunrise",
      shown: "sunrise",
      forms: ["RNAH"],
    });
    // The dictionary's wording, its edge dash off, before Dee's "appear,".
    expect(by("appear")?.shown).toBe("appear");
    // Shown in Dee's own spelling, checked as the lookup reads it.
    expect(by("to terror")).toMatchObject({
      shown: "to the terrour",
      dee: true,
    });
  });

  it("leave out notes, numerals and the denylist (garbled words go at build, by `englishOnly`)", () => {
    const texts = new Set(glosses.map((one) => one.text));
    for (const text of [
      "mean unk contemptuous tone",
      "shortened name of ave",
      "top line of tablet of 12 squar",
      "also formal noun",
      "root of don",
      "12",
      "31",
      "air name",
      "to van earth",
      "stretch forth",
    ])
      expect(texts.has(text), text).toBe(false);
  });

  it("reads a note by its wording", () => {
    for (const [shown, text] of [
      ["mean.unk. contemptuous tone", "mean unk contemptuous tone"],
      ["?STRETCH FORTH", "stretch forth"],
      ["Root of Don", "root of don"],
      ["also a formal noun", "also formal noun"],
      ["Shortened name of Ave", "shortened name of ave"],
      ["title of god", "title of god"],
      ["12", "12"],
      ["inspiration— inertia", "inspiration inertia"],
      ["Root of Don (R)", "root of don r"],
    ])
      expect(isEditorialGloss(shown, text), shown).toBe(true);
    for (const shown of [
      "sunrise",
      "the Daughter of Light",
      "self-hood",
      "God’s glory",
    ])
      expect(isEditorialGloss(shown, shown.toLowerCase()), shown).toBe(false);
  });

  it("keeps only glosses in English words, reading Dee's spelling through the lookup's", () => {
    const english = new Set(["sunrise", "to", "the", "terror", "of", "light"]);
    const kept = englishOnly(
      [
        { text: "sunrise", shown: "sunrise", forms: ["RNAH"] },
        { text: "squar", shown: "squar", forms: ["X"] },
        { text: "of light", shown: "of lyght", forms: ["X"] },
        { text: "to terror", shown: "to the terrour", dee: true, forms: ["X"] },
        { text: "sangef", shown: "Sangef", forms: ["X"] },
      ],
      english,
    );
    expect(kept.map((one) => one.text)).toEqual(["sunrise", "to terror"]);
  });
});

describe("the committed hint table", () => {
  it("was built from today's glosses", () => {
    expect(
      table.glossHash,
      "The dictionary or the Keys changed the hints' glosses: rebuild the table with `pnpm enochian:hints build`, and `pnpm enochian:hints:run` first if there are new glosses to embed (scripts/enochian-hints).",
    ).toBe(glossHash(HINT_RECIPE, glosses));
    // The table can only hold glosses of these: `englishOnly` only drops.
  });

  it("is in its format, with the recipe the script uses", () => {
    expect(table.format).toBe(HINT_TABLE_FORMAT);
    expect(table.notice).toBe(HINT_TABLE_NOTICE);
    expect(table.recipe).toBe(HINT_RECIPE.id);
    expect(text).toBe(tableText(table));
  });

  it("holds each word once, plain, a gap the lookup shows, at or above its cut-off's gloss", () => {
    const forms = new Map(glosses.map((one) => [one.shown, one.forms]));
    const words = table.hints.flatMap(([, , list]) => list.split(" "));
    expect(words).toHaveLength(table.rows);
    expect(new Set(words).size).toBe(words.length);
    for (const [gloss, shown, list] of table.hints) {
      expect(forms.get(gloss), gloss).toEqual(shown);
      expect(list.split(" ")).toEqual([...list.split(" ")].sort());
    }
    for (const word of words) {
      expect(word).toMatch(/^[a-z]+$/);
      expect(needsHint(translator, word), word).toBe(true);
    }
    expect(table.rows).toBeGreaterThan(0);
    expect(table.cutoff).toBeGreaterThanOrEqual(table.asked);
  });
});

describe("the judged sample the table shipped on", () => {
  /** The held-out sample, judged after its cut-off was chosen (README). */
  const judgedFile = readFileSync(
    path.join(
      path.dirname(path.join(root, HINT_TABLE_FILE)),
      "judged-z7-seed90.tsv",
    ),
    "utf8",
  );
  const drawnAt = Number(/table at z >= ([\d.]+)\./.exec(judgedFile)?.[1]);

  it("was drawn at the committed table's cut-off", () => {
    expect(drawnAt).toBe(7);
    expect(table.cutoff).toBe(drawnAt);
    expect(table.asked).toBe(drawnAt);
  });

  it("passes S11's bar, and every hint in it is the table's hint for its word", () => {
    const { judged, unjudged } = readVerdicts(judgedFile);
    expect(unjudged).toBe(0);
    expect(judged).toHaveLength(200);
    expect(score(judged).all).toEqual({
      n: 200,
      good: 111,
      loose: 79,
      wrong: 10,
      passes: true,
    });
    const hintOf = new Map<string, string>();
    for (const [gloss, forms, words] of table.hints)
      for (const word of words.split(" "))
        hintOf.set(word, `related: ${forms.join(", ")} ‘${gloss}’`);
    for (const one of judged) {
      expect(hintOf.get(one.word), one.word).toBe(one.hint);
      expect(one.z).toBeGreaterThanOrEqual(drawnAt);
    }
  });
});
