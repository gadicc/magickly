import { existsSync, readFileSync } from "node:fs";
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
import { readCache } from "./cache.ts";
import {
  DENYLIST,
  englishOnly,
  glossHash,
  HUB_FORMS,
  hintGlosses,
  isDeniedHint,
  isEditorialGloss,
  isGrammarGloss,
  isNameGloss,
  MAX_FORMS,
  parseWordDenylist,
  WORD_DENYLIST,
} from "./glosses.ts";
import { cacheKey, embeddingText, HINT_RECIPE } from "./recipe.ts";
import {
  readLists,
  SCOWL_RELEASE,
  scowlWords,
  WORD_CHECK_LISTS,
} from "./scowl.ts";
import {
  drawSample,
  HINT_TABLE_FILE,
  readVerdicts,
  SAMPLE_SIZE,
  type Scored,
  score,
  scoreWords,
  withoutDenied,
} from "./table.ts";
import { hintWords, needsHint } from "./words.ts";

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

describe("the word denylist", () => {
  it("reads words and the gloss they are denied, and refuses a line it can't read", () => {
    const denied = parseWordDenylist(
      "# a note\n\nliquor liquors: spirits  # drink\npump: pomp # pump\n",
    );
    expect([...denied].map(([word, texts]) => [word, [...texts]])).toEqual([
      ["liquor", ["spirits"]],
      ["liquors", ["spirits"]],
      ["pump", ["pomp"]],
    ]);
    expect(isDeniedHint("liquor", "spirits", denied)).toBe(true);
    expect(isDeniedHint("ghosts", "spirits", denied)).toBe(false);
    expect(isDeniedHint("liquor", "drink", denied)).toBe(false);
    for (const bad of ["liquor spirits", "Liquor: spirits", ": spirits"])
      expect(() => parseWordDenylist(bad), bad).toThrow(/Can't read/);
  });

  it("names only candidate glosses, by the text embedded", () => {
    const texts = new Set(glosses.map((one) => one.text));
    expect(WORD_DENYLIST.size).toBeGreaterThan(0);
    for (const [word, denied] of WORD_DENYLIST)
      for (const text of denied)
        expect(texts.has(text), `${word}: ${text}`).toBe(true);
  });

  it("takes the word's hint away rather than offering its next best", () => {
    const glossesHere = [
      { text: "spirits", shown: "spirits", forms: ["GAH"] },
      { text: "drink", shown: "drink", forms: ["X"] },
    ];
    const scored: Scored[] = [
      { word: "liquor", gloss: 0, cosine: 0.9, z: 9 },
      { word: "ghosts", gloss: 0, cosine: 0.9, z: 9 },
      { word: "wine", gloss: 1, cosine: 0.9, z: 9 },
    ];
    const denied = parseWordDenylist("liquor wine: spirits\n");
    expect(
      withoutDenied(scored, glossesHere, denied).map((one) => one.word),
    ).toEqual(["ghosts", "wine"]);
  });

  it("names only words the lookup shows as a gap", () => {
    for (const word of WORD_DENYLIST.keys())
      expect(needsHint(translator, word), word).toBe(true);
  });

  /** SCOWL's extracted lists and the vector cache, which only a build has. */
  const work = path.join(root, ".private/enochian-hints");
  const release = path.join(work, "scowl", SCOWL_RELEASE.root);
  const cacheFile = path.join(work, "vectors.jsonl");
  const built =
    existsSync(path.join(release, "final")) && existsSync(cacheFile);

  // Without `.private/` (CI, a fresh checkout) this is skipped: it needs
  // the build's lists and vectors, read from the cache alone.
  it.skipIf(!built)(
    "denies each word the gloss that is its best, so no line does nothing",
    () => {
      const english = new Set(scowlWords(readLists(release, WORD_CHECK_LISTS)));
      const scoredGlosses = englishOnly(glosses, english);
      const words = hintWords(translator, scowlWords(readLists(release)));
      const denied = [...WORD_DENYLIST.keys()];
      // Each is one of the words the build scores.
      for (const word of denied) expect(words, word).toContain(word);
      const cache = readCache(cacheFile, HINT_RECIPE.profile.dimensions);
      const vectorOf = (text: string) => {
        const vector = cache.vectors.get(
          cacheKey(HINT_RECIPE, embeddingText(HINT_RECIPE, text)),
        );
        if (!vector) throw new Error(`No vector for ${text}`);
        return vector;
      };
      for (const one of scoreWords(
        denied,
        scoredGlosses,
        vectorOf,
        HINT_RECIPE.profile.dimensions,
      ))
        expect(
          isDeniedHint(one.word, scoredGlosses[one.gloss].text),
          `${one.word}'s best is ${scoredGlosses[one.gloss].text}`,
        ).toBe(true);
    },
    120_000,
  );

  it("is counted in the gloss hash", () => {
    expect(glossHash(HINT_RECIPE, glosses)).not.toBe(
      glossHash(HINT_RECIPE, glosses, new Map()),
    );
    expect(glossHash(HINT_RECIPE, glosses, new Map())).not.toBe(
      glossHash(HINT_RECIPE, glosses, parseWordDenylist("pump: pomp")),
    );
  });

  it("leaves no denied hint in the committed table", () => {
    const textOf = new Map(glosses.map((one) => [one.shown, one.text]));
    for (const [gloss, , words] of table.hints)
      for (const word of words.split(" "))
        expect(
          isDeniedHint(word, textOf.get(gloss) as string),
          `${word}: ${gloss}`,
        ).toBe(false);
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

/**
 * Words whose hint the 19 November 2026 rebuild took away (plan 081's
 * stage-2 follow-ups): the denied ones by `word-denylist.txt`, the rest
 * because the rebuilt cache's scores put them just under the cut-off.
 * The table the seed-91 sample was drawn from is today's with these put
 * back and the judged additions taken out.
 */
const REMOVED_AFTER_SEED_91: readonly string[] = [
  // Denied: a number stretched, or a word read inside a longer one.
  "breathers",
  "eightieth",
  "eightieths",
  "eighty",
  "fifth",
  "fourteenth",
  "ghost",
  "manifesto",
  "nineties",
  "ninety",
  "phoned",
  "phoning",
  "sirloin",
  "telephoned",
  // Denied on review: the same senses as the above.
  "breather",
  "dialled",
  "manifestos",
  "sirloins",
  "telephoning",
  // Under the cut-off after the rebuild.
  "halving",
  "monologue",
  "workforce",
];

describe("the held-out sample the table ships on", () => {
  /**
   * The held-out sample, drawn after the cut-off was chosen (README): the
   * table it is drawn from is the one committed then, and it is judged
   * before the table ships.
   */
  const here = path.dirname(path.join(root, HINT_TABLE_FILE));
  const sampleText = readFileSync(
    path.join(here, "judged-z7-seed91.tsv"),
    "utf8",
  );
  const drawnAt = Number(/table at z >= ([\d.]+)\./.exec(sampleText)?.[1]);
  const seed = Number(/\(seed (\d+)\)/.exec(sampleText)?.[1]);
  /** Every drawn hint, judged or not: the word, the hint, its z. */
  const drawn = sampleText
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("n\t"))
    .map((line) => {
      const [, word, hint, z] = line.split("\t");
      return { word, hint, z: Number(z) };
    });
  /** The rebuild's added hints, each judged: the word, the hint, the verdict. */
  const added = readFileSync(
    path.join(here, "judged-added-2026-11-19.tsv"),
    "utf8",
  )
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("n\t"))
    .map((line) => {
      const [, word, hint, verdict] = line.split("\t");
      return { word, hint, verdict };
    });
  const removed = new Set(REMOVED_AFTER_SEED_91);
  const hintOf = new Map<string, string>();
  for (const [gloss, forms, words] of table.hints)
    for (const word of words.split(" "))
      hintOf.set(word, `related: ${forms.join(", ")} ‘${gloss}’`);

  it("was drawn at the committed table's cut-off", () => {
    expect(drawnAt).toBe(7);
    expect(seed).toBe(91);
    expect(table.cutoff).toBe(drawnAt);
    expect(table.asked).toBe(drawnAt);
  });

  it("holds 200 hints, each the table's hint for its word or one removed since", () => {
    expect(drawn).toHaveLength(SAMPLE_SIZE);
    for (const one of drawn) {
      expect(hintOf.get(one.word), one.word).toBe(
        removed.has(one.word) ? undefined : one.hint,
      );
      expect(one.z).toBeGreaterThanOrEqual(drawnAt);
    }
    for (const word of removed) expect(hintOf.has(word), word).toBe(false);
  });

  it("judged every hint the rebuild added, and denied the one judged wrong", () => {
    // An added word left unjudged would make the redraw below's table
    // one word too long, so that test guards this file's completeness.
    for (const one of added) {
      expect(["good", "loose", "wrong"], one.word).toContain(one.verdict);
      if (one.verdict === "wrong")
        expect(WORD_DENYLIST.has(one.word), one.word).toBe(true);
      // "bastards" (loose) was denied on review too.
      expect(hintOf.get(one.word), one.word).toBe(
        WORD_DENYLIST.has(one.word) ? undefined : one.hint,
      );
    }
  });

  /** The words of the table the sample was drawn from. */
  function drawSampleWords(): string[] {
    const today = table.hints.flatMap(([, , list]) => list.split(" "));
    const judgedHere = new Set(added.map((one) => one.word));
    return [...today.filter((word) => !judgedHere.has(word)), ...removed].sort(
      (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    );
  }

  it("is the sample that table draws with its seed", () => {
    // The build draws among the kept words, ordered by word.
    const words = drawSampleWords();
    expect(words).toHaveLength(1670);
    expect(drawSample(words, (word) => word, SAMPLE_SIZE, seed)).toEqual(
      drawn.map((one) => one.word),
    );
  });

  it("passes S11's bar, and still does without the removed words", () => {
    const { judged, unjudged } = readVerdicts(sampleText);
    expect(unjudged).toBe(0);
    expect(judged).toHaveLength(SAMPLE_SIZE);
    expect(score(judged).all).toEqual({
      n: 200,
      good: 84,
      loose: 112,
      wrong: 4,
      passes: true,
    });
    // The four wrong rows are among the denied, chosen from this very
    // sample, so the zero below is no fresh measurement: it shows only
    // that the removals took out nothing the bar relied on. "phoned"
    // (good) was denied for the telephone sense; monologue (loose) and
    // workforce (good) fell under the cut-off.
    expect(score(judged.filter((one) => !removed.has(one.word))).all).toEqual({
      n: 193,
      good: 82,
      loose: 111,
      wrong: 0,
      passes: true,
    });
  });
});
