import { readFileSync } from "node:fs";
import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import {
  type Counts,
  coverage,
  FIGURES_FILE,
  type FiguresFile,
  givenWords,
  SENTENCE_KINDS,
  selfCheck,
  TASK3_SENTENCES,
  type Task3Sentence,
  translatorFigures,
} from "./figures.ts";
import { buildKeysTable } from "./keysTable.ts";
import {
  createTranslator,
  type EnochianToken,
  type Translator,
} from "./lookup.ts";

const root = new URL("../../../../", import.meta.url);
const translator = createTranslator(buildKeysTable(), dictionary);
const { sentences } = JSON.parse(
  readFileSync(new URL(TASK3_SENTENCES, root), "utf8"),
) as { sentences: Task3Sentence[] };
const { date, ...committed } = JSON.parse(
  readFileSync(new URL(FIGURES_FILE, root), "utf8"),
) as FiguresFile;

/** A translator that gives these tokens for any text, over these Key rows. */
function stub(
  tokens: readonly Partial<EnochianToken>[],
  keyRows: readonly { english: string }[] = [],
): Translator {
  return {
    toEnochian: () => ({ input: "english", tokens }),
    lookup: {
      keyRows: new Map([
        [1, keyRows.map((row) => ({ ...row, word: "", core: [] }))],
      ]),
      display: new Map(),
    },
  } as unknown as Translator;
}

describe("the translator's figures (plan 081, decision 21)", () => {
  it("are what the script writes today; run pnpm translator:figures", () => {
    expect(
      translatorFigures(translator, sentences),
      "figures.json is stale: run pnpm translator:figures",
    ).toStrictEqual(committed);
  });

  it("are dated by the run, a real day not in the future", () => {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const day = new Date(`${date}T00:00:00Z`);
    expect(day.toISOString().slice(0, 10)).toBe(date);
    // The script writes its local date; a day's grace covers time zones.
    expect(day.getTime()).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });

  it("count each word once, in one class, and the kinds add up", () => {
    const { byKind, ...all } = committed.coverage;
    const parts: Counts[] = [all, ...Object.values(byKind)];
    for (const counts of parts) {
      expect(counts.forms + counts.chips + counts.gaps).toBe(counts.words);
      expect(counts.ruleForms).toBeLessThanOrEqual(counts.chips);
      expect(counts.gapsWithNearest).toBeLessThanOrEqual(counts.gaps);
      expect(counts.gapFree).toBeLessThanOrEqual(counts.sentences);
    }
    for (const field of Object.keys(all) as (keyof Counts)[])
      expect(
        SENTENCE_KINDS.reduce((sum, kind) => sum + byKind[kind][field], 0),
        field,
      ).toBe(all[field]);
  });

  it("cover task 3's 60 sentences, 20 of each kind", () => {
    expect(sentences).toHaveLength(60);
    expect(committed.coverage.sentences).toBe(60);
    for (const kind of SENTENCE_KINDS) {
      expect(sentences.filter((one) => one.kind === kind)).toHaveLength(20);
      expect(committed.coverage.byKind[kind].sentences).toBe(20);
    }
  });
});

describe("givenWords", () => {
  const given = (text: string) =>
    givenWords(translator, text).map((one) => one.given);

  it("counts a contraction as the words it expands to", () => {
    // "I'm" is I and am, Dee's phrase ZIR: two words, both forms.
    expect(given("I'm")).toEqual(["form", "form"]);
    expect(given("don't")).toHaveLength(2);
  });

  it("counts a rule's form as a chip, and a phrase once per word", () => {
    expect(given("is")).toEqual(["chip"]);
    expect(givenWords(translator, "is")[0].ruleForm).toBe(true);
    expect(given("the")).toEqual(["chip"]);
    // Dee's "the house" is a phrase: its article is one of its words.
    expect(given("the house")).toEqual(["form", "form"]);
    expect(given("over you")).toEqual(["form", "form"]);
  });

  it("counts a reordered possessive at its own word", () => {
    // SALMAN IAD: the tokens swap, the words keep their places.
    expect(given("God's house")).toEqual(["form", "form"]);
  });
});

describe("the figures' guards", () => {
  const form = (span: [number, number]): Partial<EnochianToken> => ({
    kind: "form",
    span,
  });

  it("throws on a word covered twice, or past the input's end", () => {
    expect(() =>
      givenWords(stub([form([0, 2]), form([1, 2])]), "one two"),
    ).toThrow("word 1 is covered twice");
    expect(() => givenWords(stub([form([0, 2])]), "one")).toThrow(
      "word 1 is covered twice or is extra",
    );
  });

  it("throws on a word given nothing", () => {
    expect(() => givenWords(stub([form([0, 1])]), "one two")).toThrow(
      "word 1 is given nothing",
    );
  });

  it("throws on a sentence of an unknown kind", () => {
    const odd = { id: "X", kind: "odd", english: "one" };
    expect(() =>
      coverage(stub([form([0, 1])]), [odd as unknown as Task3Sentence]),
    ).toThrow("unknown kind odd");
  });

  it("throws where a Key's rows and its running text disagree", () => {
    // A bracketed note across two rows: apart, each keeps its words;
    // run together, the note goes.
    expect(() =>
      selfCheck(stub([], [{ english: "fire (of" }, { english: "God) here" }])),
    ).toThrow("Key 1: rows and text disagree");
    expect(() =>
      selfCheck(stub([], [{ english: "fire of" }, { english: "God here" }])),
    ).not.toThrow();
  });
});
