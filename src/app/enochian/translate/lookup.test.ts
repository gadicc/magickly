import { readFileSync } from "node:fs";
import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import { englishTokens, englishWords, sameWord, wordKey } from "./english.ts";
import { givenWords, selfCheck } from "./figures.ts";
import { cleanGloss, dictionaryGlosses, lookupGlosses } from "./glosses.ts";
import { buildKeysTable } from "./keysTable.ts";
import { LEITCH_SPELLINGS } from "./leitchSpellings.ts";
import {
  createTranslator,
  type EnochianToken,
  type FormToken,
  KEYS_TABLE_URL,
  lineText,
  type ReadToken,
  readingGloss,
} from "./lookup.ts";
import { isEnglishWord } from "./lookupData.ts";
import { type SpellingStats, toEnglish } from "./toEnglish.ts";
import { readerTokens } from "./toEnochian.ts";
import { firstWords, MAX_WORDS } from "./tokens.ts";

const translator = createTranslator(buildKeysTable(), dictionary);
const { lookup } = translator;

/** English into Enochian, as forms, chips (·G4) and gaps ([word]). */
function enochian(text: string): string {
  return translator
    .toEnochian(text)
    .tokens.map((one) =>
      one.kind === "form"
        ? one.form
        : one.kind === "chip"
          ? `·${one.rule}`
          : `[${one.english}]`,
    )
    .join(" ");
}

const only = (text: string): EnochianToken => {
  const { tokens } = translator.toEnochian(text);
  expect(tokens).toHaveLength(1);
  return tokens[0];
};

const form = (text: string): FormToken => {
  const one = only(text);
  if (one.kind !== "form") throw new Error(`${text}: ${one.kind}`);
  return one;
};

/** Enochian into English: the reading line as text. */
const english = (text: string) => lineText(translator.toEnglish(text).line);

const word = (text: string): ReadToken => {
  const { tokens } = translator.toEnglish(text);
  expect(tokens).toHaveLength(1);
  return tokens[0];
};

/** A Key's rows, from 1. */
const rows = (key: number) => lookup.keyRows.get(key) ?? [];

describe("English words as compared", () => {
  it("expands contractions before the possessive goes (decision 6)", () => {
    expect(englishTokens("It's God's").map((one) => one.word)).toEqual([
      "it",
      "is",
      "god",
    ]);
    const [it, is, god] = englishTokens("It's God's");
    expect(it.contraction).toBe("It's");
    expect(is).toMatchObject({ surface: "is", contraction: "It's" });
    expect(god).toMatchObject({ possessive: true, surface: "God's" });
    expect(englishTokens("can't won't I'm").map((one) => one.word)).toEqual([
      "can",
      "not",
      "will",
      "not",
      "i",
      "am",
    ]);
  });

  it("reads Dee's spellings and irregular verbs as today's", () => {
    expect(englishTokens("naïve café").map((one) => one.word)).toEqual([
      "naive",
      "cafe",
    ]);
    expect(englishTokens("shew the firmamets").map((one) => one.word)).toEqual([
      "show",
      "the",
      "firmaments",
    ]);
    expect(wordKey("came")).toBe(wordKey("come"));
    expect(wordKey("walkest")).toBe("walk");
    expect(wordKey("forest")).toBe("forest");
  });

  it("ignores (see …) in a gloss, and reads WE's inversions forwards (decision 22, 7)", () => {
    expect(dictionaryGlosses("govern, to; (see 'cab')")).toEqual([
      "govern",
      "to govern",
    ]);
    expect(dictionaryGlosses("PEACE, IN")).toEqual(["IN PEACE"]);
    expect(cleanGloss("the God of righteousnesse, ")).toBe(
      "the God of righteousnesse",
    );
  });

  it("reads two meanings at a comma as two, not one inverted", () => {
    expect(dictionaryGlosses("in, with")).toEqual(["in", "with"]);
    expect(dictionaryGlosses("flame, fire")).toEqual(["flame", "fire"]);
    expect(dictionaryGlosses("I, my")).toEqual(["I", "my"]);
    expect(dictionaryGlosses("harlot, (of an)")).toEqual([
      "harlot",
      "of an harlot",
    ]);
    // So no form is "fire flame", "with in" or "my I".
    expect(translator.toEnochian("fire flame").tokens).toHaveLength(2);
    expect(translator.toEnochian("with in").tokens).toHaveLength(2);
    expect(enochian("in")).toBe("A");
  });

  it("keeps the note-stripping linear on unclosed brackets", () => {
    const text = `${"(".repeat(100_000)}light`;
    expect(englishWords(text)).toEqual(["light"]);
    expect(cleanGloss(`light${",".repeat(100_000)}`)).toBe("light");
  });
});

describe("English into Enochian (decisions 6–12)", () => {
  it("gives the spike's common words", () => {
    const expected: Record<string, string> = {
      I: "OL",
      her: "TILB",
      his: "TOX",
      house: "SALMAN",
      this: "OI",
      earth: "CAOSGI",
      and: "OD",
      God: "IAD",
      is: "I",
      are: "CHIS",
      was: "ZIROP",
      not: "IP",
    };
    for (const [text, want] of Object.entries(expected))
      expect(form(text).form, text).toBe(want);
  });

  it("matches the longest phrase first, within one line (decision 6)", () => {
    expect(form("over you")).toMatchObject({ form: "VORSG", tier: 1 });
    expect(form("cast down").form).toBe("ADRPAN");
    expect(form("his power")).toMatchObject({
      form: "LONSHITOX",
      source: { kind: "keys", rows: [{ key: 13, row: 20 }] },
      entries: ["LONSHI", "TOX"],
    });
  });

  it("never ignores a be-form or pronoun: I am is ZIR, not a form of I (decision 7)", () => {
    expect(form("I am")).toMatchObject({ form: "ZIR", tier: 1 });
    // ZIRDO is said nine times, but eight are the closing formula (G40).
    expect(form("I am").alternatives.map((one) => one.form)).toContain("ZIRDO");
    expect(form("I")).toMatchObject({ form: "OL", rule: "G21" });
    expect(form("am")).toMatchObject({ form: "ZIR", rule: "G13" });
  });

  it("gives ETHARZI as tier 3 for peace, with its 'in' shown (decision 7)", () => {
    expect(form("peace")).toMatchObject({
      form: "ETHARZI",
      tier: 3,
      chips: [{ kind: "carries", word: "in" }],
      source: { kind: "dictionary", headword: "ETHARZI" },
    });
    expect(form("in peace")).toMatchObject({ form: "ETHARZI", tier: 1 });
  });

  it("takes a leading of or to either side at tier 2", () => {
    expect(enochian("to the house")).toBe("SALMAN");
    expect(form("to the house").tier).toBe(2);
  });

  it("labels a dictionary-only form with its source, and lists the others (decision 8)", () => {
    expect(form("this")).toMatchObject({
      form: "OI",
      source: { kind: "dictionary", work: "WE", inKeys: false },
    });
    // O, a number in Key 11, also means "this" in WE: offered, not chosen.
    expect(form("this").alternatives).toContainEqual(
      expect.objectContaining({ form: "O" }),
    );
  });

  it("follows the grammar-word table, each change shown (decision 9)", () => {
    expect(enochian("a dog of a cat")).toBe("·G4 [dog] ·G5 ·G4 [cat]");
    // A phrase takes its own "of": OIAD-like forms come through phrases.
    expect(only("of God").kind).toBe("form");
    expect(enochian("I will come")).toBe("OL ·G16 NIIS");
    expect(enochian("no")).toBe("AG");
    expect(enochian("were")).toBe("ZIROM");
    for (const gap of [
      "never",
      "let",
      "to",
      "can",
      "may",
      "must",
      "be",
      "been",
    ])
      expect(only(gap).kind, gap).toBe("gap");
    // GE follows its word (G32) and DE can't be placed: never chosen.
    expect(enochian("not of")).toBe("IP ·G5");
  });

  it("reads an irregular verb in its one form, with a G16 chip", () => {
    expect(form("came")).toMatchObject({
      form: "NIIS",
      chips: [{ kind: "tense", rule: "G16", plain: "come" }],
    });
  });

  it("gives a regular past tense the same G16 chip", () => {
    expect(form("reigned")).toMatchObject({
      form: "SONF",
      chips: [{ kind: "tense", rule: "G16", plain: "reign" }],
    });
    expect(form("reign").chips).toEqual([]);
    // A word that only looks like one keeps no chip.
    expect(form("house").chips).toEqual([]);
  });

  it("tries a word as written before its irregular verb's plain form", () => {
    // Dee wrote "rose" himself (TORZULP "rose up"), so it is not TORZUL
    // "rise"; "came" has no form as written, so it meets "come".
    expect(form("rose").form).not.toBe("TORZUL");
    expect(form("rose").chips).not.toContainEqual(
      expect.objectContaining({ kind: "tense" }),
    );
    expect(form("came").form).toBe("NIIS");
  });

  it("leaves out an auxiliary before its verb or its subject, not a main verb (G16)", () => {
    expect(enochian("do you love me")).toMatch(/^·G16 NONCF \S+ \[me\]$/);
    expect(enochian("have you seen it")).toBe("·G16 NONCF [seen] TI");
    expect(enochian("shall I come")).toBe("·G16 OL NIIS");
    expect(enochian("I have seen")).toBe("OL ·G16 [seen]");
    expect(enochian("I have not")).toBe("OL ·G16 IP");
    // "Have" before a noun or at the end is a verb of its own.
    for (const text of ["I have power", "I have"]) {
      const have = translator.toEnochian(text).tokens[1];
      expect(have.kind, text).toBe("form");
    }
    expect(enochian("do the work")).not.toMatch(/^·G16/);
  });

  it("takes an article at a phrase's edge only where Dee's gloss has it", () => {
    // ODO is "open": "the" is the gates', and shows its chip.
    expect(enochian("Open the gates")).toMatch(/^ODO ·G4 /);
    expect(enochian("building a house")).toBe("TROF ·G4 SALMAN");
    // CNOQOD's "servants, his" is "his servants", so "of his" is G5 and
    // TOX after the noun; an exact gloss of grammar words still counts.
    expect(enochian("under you")).toBe("OROCH");
    // A pronoun at the head is the meaning: TILB "HER, OF", TLB "HIM, OF".
    expect(enochian("of her")).toBe("TILB");
    expect(enochian("of him")).toBe("TLB");
    expect(dictionaryGlosses("HER, IN")).toEqual(["IN HER"]);
    // A tail with a pronoun keeps the head: "beauty" is still TVRBS.
    expect(dictionaryGlosses("BEAUTY, IN THEIR")).toEqual([
      "BEAUTY",
      "IN THEIR BEAUTY",
    ]);
    expect(enochian("thou art")).toBe("GEH");
    expect(enochian("the gates of his holy house")).not.toMatch(/CNOQOD/);
    expect(enochian("the gates of his holy house")).toMatch(/TOX/);
    // SALMAN is Dee's "the house": the article is his.
    expect(enochian("the house")).toBe("SALMAN");
    // A leading article no phrase of its own begins with is a chip, and
    // Dee's longer phrase starts at the next word.
    expect(enochian("the earth quakes")).toBe("·G4 GIZYAX");
    expect(enochian("the third flame")).toBe("·G4 DIALPRT");
    // Past tier 2's "of": MAD is "of the same your God".
    expect(enochian("the same your God")).toBe("MAD");
    // Any of Dee's rows may hold the article: VONPH is "the wrath" at 13.8.
    expect(enochian("the wrath")).toBe("VONPH");
    // A trailing vocative "O" is the next word's.
    expect(translator.toEnochian("come o lord").tokens[0].span).toEqual([0, 1]);
  });

  it("matches no phrase across the end of a clause", () => {
    expect(enochian("I am. The Lord your God")).toBe("ZIR ENAY PIAD");
    expect(enochian("I am the Lord your God")).not.toBe("ZIR ENAY PIAD");
  });

  it("expands a contraction and says so", () => {
    const { tokens } = translator.toEnochian("it's light");
    expect(tokens.map((one) => one.kind)).toEqual(["form", "form", "form"]);
    expect(tokens[0]).toMatchObject({ form: "TI", contraction: "it's" });
    expect(tokens[1]).toMatchObject({
      form: "I",
      rule: "G13",
      contraction: "it's",
    });
    expect(enochian("don't go")).toBe("·G16 IP [go]");
  });

  it("takes a pronoun's form from Dee's exact gloss where he has one (decision 10)", () => {
    expect(form("it")).toMatchObject({
      form: "TI",
      rule: "G21",
      source: { kind: "keys", rows: [{ key: 11, row: 21 }] },
    });
    expect(form("thou").form).toBe("ILS");
    // NONCF "you" twice, NONCI once: the one he uses most, the other offered.
    expect(form("you").form).toBe("NONCF");
    expect(form("you").alternatives.map((one) => one.form)).toContain("NONCI");
    // No source glosses "thee" or "ye" alone.
    expect(only("thee").kind).toBe("gap");
    expect(only("ye").kind).toBe("gap");
  });

  it("gives a rule's form an honest source: the note and where Dee writes it", () => {
    expect(form("his")).toMatchObject({
      form: "TOX",
      rule: "G22",
      source: {
        kind: "rule",
        rule: "G22",
        rows: [],
        joined: [{ key: 13, row: 20, english: "his power," }],
      },
    });
    for (const text of [
      "is",
      "are",
      "art",
      "am",
      "was",
      "were",
      "not",
      "no",
      "none",
    ]) {
      const { source, rule } = form(text);
      expect(source.kind, text).toBe("rule");
      if (source.kind !== "rule") continue;
      expect(source.rule, text).toBe(rule);
      expect(source.rows.length + source.joined.length, text).toBeGreaterThan(
        0,
      );
    }
  });

  it("gives a pronoun its form, or a gap: never 'implied' (decision 10)", () => {
    expect(enochian("her course")).toBe("ELZAPTILB");
    expect(enochian("killed her")).toBe("[killed] [her]");
    expect(enochian("he came")).toBe("[he] NIIS");
    expect(enochian("me")).toBe("[me]");
  });

  it("writes a possessive after its noun, apart, with its chip (decision 11)", () => {
    expect(enochian("her house")).toBe("SALMAN TILB");
    expect(enochian("his house")).toBe("SALMAN TOX");
    const { tokens } = translator.toEnochian("God's house");
    expect(
      tokens.map((one) => (one.kind === "form" ? one.form : one.kind)),
    ).toEqual(["SALMAN", "IAD"]);
    expect(tokens[1]).toMatchObject({
      english: "God's",
      span: [0, 1],
      chips: [{ kind: "reordered", rule: "G5" }],
    });
    expect((tokens[0] as FormToken).chips).toEqual([]);
  });

  it("moves a possessive past the next word only (decision 11)", () => {
    // A following verb or preposition stays where the English has it.
    expect(enochian("his son came")).toBe("NOR TOX NIIS");
    expect(enochian("her house stands")).toBe("SALMAN TILB BIAB");
    expect(enochian("God's light shines upon us")).toMatch(
      /^OLPIRT IAD \S+ \S+ \[us\]$/,
    );
    // A phrase is one item: LONSHITOX is not moved past.
    expect(enochian("God's his power")).toBe("LONSHITOX IAD");
    // Nested: house, then its possessor God, then God's possessor.
    const nested = translator.toEnochian("his God's house").tokens;
    expect(
      nested.map((one) => (one.kind === "form" ? one.form : one.kind)),
    ).toEqual(["SALMAN", "IAD", "TOX"]);
    expect(nested.slice(1).map((one) => (one as FormToken).chips)).toEqual([
      [{ kind: "reordered", rule: "G5" }],
      [{ kind: "reordered", rule: "G22" }],
    ]);
    // Nor past the end of a clause.
    expect(enochian("God's. House")).toBe("IAD SALMAN");
  });

  it("reorders a chain of possessives as long as the input, without recursing", () => {
    const chain = `${Array(10_000).fill("God's").join(" ")} house`;
    const { tokens } = translator.toEnochian(chain);
    expect(tokens).toHaveLength(10_001);
    expect(tokens[0]).toMatchObject({ form: "SALMAN", chips: [] });
    // Nearest possessor first: the last "God's" typed.
    expect(tokens[1]).toMatchObject({ form: "IAD", span: [9999, 10_000] });
    expect(tokens[10_000]).toMatchObject({
      form: "IAD",
      span: [0, 1],
      chips: [{ kind: "reordered", rule: "G5" }],
    });
  });

  it("reorders a plural possessive like a singular one", () => {
    const { tokens } = translator.toEnochian("Gods' house");
    expect(
      tokens.map((one) => (one.kind === "form" ? one.form : one.kind)),
    ).toEqual(["SALMAN", "IAD"]);
    expect(tokens[1]).toMatchObject({
      english: "Gods'",
      chips: [{ kind: "reordered", rule: "G5" }],
    });
  });

  it("shows a gap's nearest forms, each with its source (decision 12)", () => {
    const master = only("master");
    expect(master.kind).toBe("gap");
    if (master.kind !== "gap") return;
    expect(master.nearest[0]).toMatchObject({
      form: "GEIAD",
      source: { kind: "keys" },
    });
    expect(master.nearest.length).toBeLessThanOrEqual(3);
  });

  it("never takes CABA's (see 'cab') for 'see' (decision 22)", () => {
    const see = only("see");
    expect(see.kind).toBe("gap");
    if (see.kind !== "gap") return;
    expect(see.nearest.map((one) => one.form)).not.toContain("CABA");
    expect(see.nearest.map((one) => one.form)).toContain("IPURAN");
  });

  it("gives Dee's own word back for nearly all his content rows", () => {
    // The self-consistency figure is step D's (`figures.ts`); this guards
    // against a collapse, near the spike's 944 of 1,054.
    const { rows, found } = selfCheck(translator);
    expect(rows).toBe(1054);
    expect(found).toBeGreaterThanOrEqual(940);
  });
});

describe("Enochian into English (decisions 13–16)", () => {
  it("reads a run of Dee's lines as his English (decision 14)", () => {
    for (const [key, n] of [
      [1, 20],
      [2, 16],
    ] as const) {
      const run = rows(key).slice(0, n);
      const { line } = translator.toEnglish(
        run.map((row) => row.word).join(" "),
      );
      expect(line).toHaveLength(1);
      expect(line[0].kind).toBe("dee");
      expect(line[0].text).toBe(
        run
          .map((row) => cleanGloss(row.english))
          .filter(Boolean)
          .join(" "),
      );
    }
    expect(english("ZACAR OD ZAMRAN")).toBe("Move And shew your selves");
  });

  it("reads other words word by word, Dee's punctuation off", () => {
    const { line } = translator.toEnglish("BALT IAD GOHO");
    expect(line.map((one) => one.kind)).toEqual(["word", "word", "word"]);
    expect(lineText(line)).toBe("of Justice the God saith");
    // ZIRDO's gloss is only ever our split of Dee's English: on the line,
    // marked as ours (decision 14).
    const zirdo = translator.toEnglish("ZIRDO");
    expect(zirdo.line).toEqual([
      { kind: "ours", text: "I am", tokens: [0, 1] },
    ]);
    expect(zirdo.tokens[0].readings[0].words[0]).toMatchObject({
      gloss: "I am",
      ours: true,
    });
    expect(lineText(translator.toEnglish("BALT ZIRDO").line)).toBe(
      "of Justice ‹I am›",
    );
    // A part of a split, not the whole word: DS "which" stays on the line.
    expect(translator.toEnglish("DSSALMAN").line).toEqual([
      { kind: "word", text: "which", tokens: [0, 1], parts: [0, 1] },
      { kind: "ours", text: "the house", tokens: [0, 1], parts: [1, 2] },
    ]);
    expect(lineText(translator.toEnglish("LSALMAN").line)).toBe(
      "of the first ‹the house›",
    );
    // A form spanning two of Dee's words, both his own glosses: one segment.
    expect(translator.toEnglish("sobrazod-ol").line).toEqual([
      { kind: "word", text: "in whose hands", tokens: [0, 1], parts: [0, 2] },
    ]);
  });

  it("keeps a run whole where it starts or ends on a row we divided", () => {
    // FARZM's English ends where we cut Dee's running English, but the
    // words are his; the data doesn't record his units' edges yet.
    expect(translator.toEnglish("PILAH FARZM").line).toEqual([
      {
        kind: "dee",
        text: "moreover you lifted up your voices",
        tokens: [0, 2],
      },
    ]);
    // The Keys' close, every row of it divided in Key 1, is still his.
    const close = translator.toEnglish(
      "ZACAR CA OD ZAMRAN ODO CICLE QAA ZORGE LAP ZIRDO NOCO MAD HOATH IAIDA",
    ).line;
    expect(close.map((one) => one.kind)).toEqual(["dee"]);
    // Alone, a divided word is marked; two parts of one word each on
    // their own.
    expect(lineText(translator.toEnglish("FARZM").line)).toBe(
      "‹you lifted up your voices›",
    );
    expect(lineText(translator.toEnglish("COMOBLIORT").line)).toBe(
      "‹a window› ‹of comfort›",
    );
  });

  it("marks 60 of Dee's 660 words, alone, as read by our division", () => {
    // Their only English is our split of his running English.
    const lines = [...lookup.keyForms.keys()].map(
      (one) => [one, translator.toEnglish(one).line] as const,
    );
    // An `ours` segment always carries its English.
    for (const [one, line] of lines)
      for (const segment of line)
        if (segment.kind === "ours") expect(segment.text, one).not.toBe("");
    const ours = lines
      .filter(([, line]) => line.some((segment) => segment.kind === "ours"))
      .map(([one]) => one);
    expect(ours).toHaveLength(60);
    expect(ours).toContain("ZIRDO");
  });

  it("gives a dictionary-only word a short gloss, with its source", () => {
    const madriax = word("MADRIAX");
    expect(madriax.readings[0]).toMatchObject({
      via: "dictionary",
      words: [{ word: "MADRIAX", rows: [] }],
    });
    expect(madriax.readings[0].words[0].gloss).not.toMatch(/[,;(]/);
    expect(madriax.readings[0].words[0].work).toBeTruthy();
  });

  it("reads Crowley's Golden Dawn forms as Dee's words (decision 13)", () => {
    const run = rows(1).slice(0, 20);
    const { line } = translator.toEnglish(
      run
        .map((row) => row.gd)
        .filter(Boolean)
        .join(" "),
    );
    expect(line).toHaveLength(1);
    // Crowley leaves out VONPHO "of wrath"; his SOBRAZOD-OL is SOBRA ZOL.
    expect(line[0].text).toContain("firmamets in whose hands The Sun");
    // A form spanning two of Dee's words carries both glosses.
    expect(word("sobrazod-ol").readings[0]).toMatchObject({
      via: "gd",
      words: [
        { word: "SOBRA", gloss: "in whose" },
        { word: "ZOL", gloss: "hands" },
      ],
    });
    expect(english("vaoresaji")).toBe("over you");
    // Spaced as Crowley prints it.
    expect(word("das iod").readings[0].words.map((one) => one.word)).toEqual([
      "DSI",
      "OD",
    ]);
  });

  it("reads Leitch's spellings as Dee's words at their rows (decision 13)", () => {
    expect(word("PRGEL").readings[0]).toMatchObject({
      via: "leitch",
      words: [{ word: "PURGEL", rows: [{ key: 9, row: 3 }] }],
      leitchPage: 432,
    });
    // Kept whole, not split by the rule.
    const sobaiad = word("SOBAIAD");
    expect(sobaiad.readings).toHaveLength(1);
    expect(sobaiad.readings[0]).toMatchObject({
      via: "leitch",
      words: [
        { word: "SOBA", rows: [{ key: 17, row: 15 }] },
        { word: "IAD", rows: [{ key: 17, row: 16 }] },
      ],
    });
    // At two places with the same words: one reading.
    expect(word("ODZAMRAN").readings).toHaveLength(1);
    expect(word("ODZAMRAN").readings[0].words.map((one) => one.word)).toEqual([
      "OD",
      "ZAMRAN",
    ]);
  });

  it("reads a Key 19 Aethyr in its slot with its ordinal", () => {
    const slot = rows(19).find((row) => row.aethyrSlot);
    expect(slot?.english).toBe("In the first air");
    const before = rows(19).slice(0, 3);
    const text = `${before.map((row) => row.word).join(" ")} ARN`;
    expect(english(text)).toMatch(/In the second air$/);
  });

  it("reads OD once, though Crowley also prints it where Casaubon's word is lost", () => {
    expect(word("OD").readings).toHaveLength(1);
  });

  it("shows Crowley's form as he prints it where Casaubon's print lost Dee's word", () => {
    const row = rows(14)[1];
    expect(row.word).toBe("");
    const [reading] = word(row.gd).readings;
    expect(reading.words[0]).toMatchObject({
      word: row.gd,
      notInCasaubon: true,
    });
    // Leitch's spellings there read the same way.
    expect(word("DSINSI").readings[0].words).toMatchObject([
      { word: "das", notInCasaubon: true },
      { word: "inusi", notInCasaubon: true },
    ]);
  });

  it("never shows a spelling no source prints", () => {
    const printed = new Set<string>([
      ...lookup.rows.flatMap((row) => [row.word, row.gd]),
      // A headword in capitals, as every source prints Enochian: the
      // transcription's "fatesged" is shown FATESGED.
      ...Object.keys(dictionary).map((one) => one.toUpperCase()),
      ...LEITCH_SPELLINGS.map((one) => one.word),
      // Key 19's slot: the Aethyrs' names, in the capitals Dee's words have.
      ...buildKeysTable().aethyrs.flat(),
    ]);
    const seen = new Set<string>();
    const inputs = [
      ...[...lookup.keyRows.values()].flatMap((keyRows) => [
        keyRows.map((row) => row.word).join(" "),
        keyRows.map((row) => row.gd).join(" "),
      ]),
      ...LEITCH_SPELLINGS.map((one) => one.word),
      ...Object.keys(dictionary).slice(0, 400),
      "DSSALMAN ODSALMAN SALMANTOX OISALMAN SALMANX BAIIHIE CAOSAII",
    ];
    for (const text of inputs)
      for (const token of translator.toEnglish(text).tokens) {
        for (const reading of token.readings)
          for (const one of reading.words) seen.add(one.word);
        for (const one of token.nearest) seen.add(one);
      }
    for (const keyRows of lookup.keyRows.values())
      for (const token of translator.toEnochian(
        keyRows.map((row) => row.english).join(" "),
      ).tokens) {
        if (token.kind === "form") {
          seen.add(token.form);
          for (const one of token.alternatives) seen.add(one.form);
        }
        if (token.kind === "gap")
          for (const one of token.nearest) seen.add(one.form);
      }
    expect([...seen].filter((one) => !printed.has(one))).toEqual([]);
  });

  it("finds a word not in our data by edit distance (decision 16)", () => {
    const typo = word("SALMANX");
    expect(typo.readings).toEqual([]);
    expect(typo.nearest).toContain("SALMAN");
    expect(english("SALMANX")).toBe("[SALMANX?]");
  });

  it("looks a repeated unknown word up once, against spellings of a near length", () => {
    const once: SpellingStats = { distances: 0 };
    toEnglish(lookup, "SALMANX", once);
    const spellings = new Set([
      ...lookup.keyForms.keys(),
      ...lookup.dictionary.keys(),
      ...lookup.gdForms.keys(),
    ]).size;
    expect(once.distances).toBeGreaterThan(0);
    expect(once.distances).toBeLessThan(spellings);
    const many: SpellingStats = { distances: 0 };
    toEnglish(lookup, Array(2000).fill("SALMANX").join(" "), many);
    expect(many.distances).toBe(once.distances);
  });
});

describe("what it is built from", () => {
  it("needs only the dictionary's meanings and their sources", () => {
    const slim = Object.fromEntries(
      Object.entries(dictionary).map(([headword, entry]) => [
        headword,
        {
          meanings: entry.meanings.map(({ meaning, source }) => ({
            meaning,
            source,
          })),
        },
      ]),
    );
    const fromSlim = createTranslator(buildKeysTable(), slim);
    for (const text of ["peace", "this", "master", "God's house"])
      expect(fromSlim.toEnochian(text), text).toEqual(
        translator.toEnochian(text),
      );
    expect(fromSlim.toEnglish("MADRIAX")).toEqual(
      translator.toEnglish("MADRIAX"),
    );
  });

  it("marks no closing formula on a Key 11–18 without its ZACAR", () => {
    const table = buildKeysTable();
    const damaged = {
      ...table,
      keys: table.keys.map((one) =>
        one.key === 11
          ? {
              ...one,
              rows: one.rows.map(
                (row) =>
                  (row[0] === "ZACAR"
                    ? ["", ...row.slice(1)]
                    : row) as typeof row,
              ),
            }
          : one,
      ),
    };
    const built = createTranslator(damaged, dictionary).lookup;
    expect(built.keyRows.get(11)?.some((row) => row.formula)).toBe(false);
    expect(rows(11).some((row) => row.formula === "repeat")).toBe(true);
  });

  it("names where the page fetches the Keys table", () => {
    expect(KEYS_TABLE_URL).toBe("/enochian/translate/keys.json");
  });
});

describe("the join rule (decision 15)", () => {
  /** The rule on a Key word as if we didn't have it. */
  const heldOut = (word: string) =>
    translator
      .joinSplits(word, new Set([word]))
      .map(({ parts, rules }) => `${parts.join("+")} ${rules.join(",")}`);

  it("splits a word not found whole, each split marked with its rule", () => {
    const { readings } = word("DSSALMAN");
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ via: "split", rules: ["G26"] });
    expect(readingGloss(readings[0])).toBe(
      `which ${readingGloss(word("SALMAN").readings[0])}`,
    );
    expect(word("ODSALMAN").readings[0].rules).toEqual(["G30"]);
    expect(word("SALMANTOX").readings[0].rules).toEqual(["G22"]);
  });

  it("splits the held-out Key words it gets right", () => {
    expect(heldOut("DSONF")).toEqual(["DS+SONF G26,G27"]);
    expect(heldOut("ISALMAN")).toEqual(["I+SALMAN G26"]);
    expect(heldOut("CHISHOLQ")).toEqual(["CHIS+HOLQ G26"]);
    expect(heldOut("LONSHITOX")).toEqual(["LONSHI+TOX G22"]);
    expect(heldOut("ELZAPTILB")).toEqual(["ELZAP+TILB G22"]);
    expect(heldOut("AGTOLTORN")).toEqual(["AG+TOLTORN G26"]);
    // Two readings when two fit.
    expect(heldOut("OISALMAN")).toEqual([
      "OI+SALMAN G26",
      "OI+ISALMAN G26,G27",
    ]);
  });

  it("splits the held-out Key words it gets wrong, as the spike found", () => {
    expect(heldOut("ARCAOSGI")).toEqual(["AR+CAOSGI G26"]);
    expect(heldOut("IOIAD")).toEqual(["I+OIAD G26"]);
    expect(heldOut("IZIZOP")).toEqual(["I+ZIZOP G26"]);
    expect(heldOut("OIAD")).toEqual(["OI+IAD G26,G27"]);
    expect(heldOut("TATAN")).toEqual(["TA+TAN G26"]);
  });

  it("splits 25 of Dee's 660 words when each is held out", () => {
    const words = [...lookup.keyForms.keys()];
    expect(words).toHaveLength(660);
    expect(words.filter((one) => heldOut(one).length > 0)).toHaveLength(25);
  });

  it("takes no Q in front, and I and L only before Dee's words", () => {
    expect(heldOut("QCOCASB")).toEqual([]);
    expect(word("QSALMAN").readings).toEqual([]);
    // MADRIAX is a dictionary word, not one of Dee's.
    expect(translator.joinSplits("LMADRIAX")).toEqual([]);
    expect(translator.joinSplits("DSMADRIAX")).toHaveLength(1);
  });
});

describe("the direction guess (decision 4)", () => {
  it("reads the spike's short inputs, English on a tie", () => {
    const cases: [string, "english" | "enochian"][] = [
      ["a man", "english"],
      ["no", "english"],
      ["fire", "english"],
      ["I am", "english"],
      ["peace", "english"],
      ["holy light", "english"],
      ["the house of God", "english"],
      ["I love you", "english"],
      ["come to me", "english"],
      ["and", "english"],
      ["do not go", "english"],
      ["angel", "english"],
      ["good morning", "english"],
      ["thank you", "english"],
      ["rise", "english"],
      ["I", "english"],
      ["OD", "enochian"],
      ["OL", "enochian"],
      ["IAD", "enochian"],
      ["Zacar od zamran", "enochian"],
      ["ol sonf vorsg", "enochian"],
      ["micma", "enochian"],
      ["Ol sonuf vaoresaji", "enochian"],
      ["madriax", "enochian"],
      ["niis", "enochian"],
      ["L", "enochian"],
      ["DS", "enochian"],
      ["torzu gohe", "enochian"],
      ["oisalman", "enochian"],
      ["DSSALMAN", "enochian"],
      ["zir", "enochian"],
    ];
    for (const [text, language] of cases)
      expect(translator.guessDirection(text).language, text).toBe(language);
  });

  it("shows both readings for one or two words that score both ways", () => {
    for (const text of ["I", "fire", "a man"])
      expect(translator.guessDirection(text).both, text).toBe(true);
    expect(translator.guessDirection("the house of God").both).toBe(false);
    expect(translator.guessDirection("OD").both).toBe(false);
    const both = translator.translate("I");
    expect(both.toEnochian?.tokens[0]).toMatchObject({ form: "OL" });
    expect(both.toEnglish?.tokens[0].readings[0].words[0].gloss).toBe("is");
    expect(translator.translate("I", "enochian").toEnochian).toBeUndefined();
  });

  it("counts Leitch's spellings as Enochian, and reads mixed input by share", () => {
    expect(translator.guessDirection("PRGEL").language).toBe("enochian");
    expect(
      translator.guessDirection("Zacar od zamran the house").language,
    ).toBe("enochian");
    expect(translator.guessDirection("come to the house of OL").language).toBe(
      "english",
    );
  });
});

describe("the rules it names", () => {
  const notes = readFileSync(
    new URL(
      "../../../../packages/magick-data/src/enochian/grammar.md",
      import.meta.url,
    ),
    "utf8",
  );
  const title = (rule: string) =>
    notes.match(new RegExp(`^### ${rule}\\. (.+)$`, "m"))?.[1];

  it("names grammar notes that exist, on their subject", () => {
    const expected: Record<string, RegExp> = {
      G4: /articles/,
      G5: /"Of"/,
      G13: /"To be"/,
      G14: /"To be"/,
      G16: /verbs/,
      G21: /pronouns/,
      G22: /Possessives/,
      G26: /Small words/,
      G27: /shared letter/,
      G30: /OD/,
      G33: /IP/,
      G34: /AG/,
      G40: /closing formula/,
    };
    for (const [rule, subject] of Object.entries(expected))
      expect(title(rule), rule).toMatch(subject);
  });
});

describe("the final review's findings (plan 081, stage 1)", () => {
  /** The tokens' kinds and spans: every typed word covered once. */
  const covered = (text: string) => givenWords(translator, text).length;

  it("M1: keeps a letter's name out of English into Enochian", () => {
    expect(enochian("male and female")).toBe("[male] OD [female]");
    expect(enochian("a pale horse")).toBe("·G4 [pale] [horse]");
    expect(enochian("tell a tale")).toBe("[tell] ·G4 [tale]");
    for (const name of ["fame", "gale", "graph", "don", "med", "un", "mals"]) {
      const one = only(name);
      expect(one.kind, name).toBe("gap");
      if (one.kind === "gap")
        expect(
          one.nearest.map((near) => near.form),
          name,
        ).toEqual([]);
    }
    // WE's letter entries, as English into Enochian reads them.
    expect(lookupGlosses("Mals (P)")).toEqual([]);
    expect(lookupGlosses("GAL, ENOCHIAN LETTER D")).toEqual([
      "ENOCHIAN LETTER D",
    ]);
    // Reading Enochian still shows the name as WE gives it.
    expect(dictionaryGlosses("Mals (P)")).toEqual(["Mals"]);
    // "or" is Q's meaning, not a letter's name.
    expect(enochian("fire or water")).toBe("PRGE Q ZIN");
  });

  it("M2: matches a word only as itself or a regular inflection", () => {
    for (const word of [
      "stare",
      "mane",
      "rode",
      "fore",
      "site",
      "sole",
      "rune",
      "sine",
      "theme",
    ])
      expect(only(word).kind, word).toBe("gap");
    expect(enochian("a doe")).toBe("·G4 [doe]");
    // Regular inflections still meet: -ing, -ed, plurals, doubling.
    expect(form("making").form).toBe("EOLIS");
    expect(form("loved")).toMatchObject({
      form: "TOANT",
      chips: [{ kind: "tense", rule: "G16", plain: "love" }],
    });
    expect(form("stars").form).toBe("AOIVEAE");
    expect(form("houses").form).toBe("SALMAN");
    expect(form("running").form).toBe("PARM");
    for (const [typed, gloss] of [
      ["making", "make"],
      ["loved", "love"],
      ["stars", "star"],
      ["houses", "house"],
      ["stopped", "stop"],
      ["glories", "glory"],
      ["carried", "carry"],
      ["walketh", "walk"],
      ["loved", "loving"],
    ])
      expect(sameWord(typed, gloss, true), `${typed} ${gloss}`).toBe(true);
    for (const [typed, gloss] of [
      ["stare", "star"],
      ["stare", "stars"],
      ["mane", "man"],
      ["doe", "does"],
      ["theme", "them"],
      ["stared", "stars"],
    ])
      expect(sameWord(typed, gloss), `${typed} ${gloss}`).toBe(false);
    // An irregular verb meets its plain form only on the second try.
    expect(sameWord("came", "come", true)).toBe(false);
    expect(sameWord("came", "come")).toBe(true);
    // Dee's final e is a spelling of his, modernised on both sides.
    expect(form("brightness").form).toBe("LUCIFTIAS");
  });

  it("M3: gives every typed word a form, chip or gap, brackets and scripts too", () => {
    expect(enochian("the house (of God)")).toBe("SALMAN MAD");
    expect(covered("the house (of God)")).toBe(4);
    expect(
      englishTokens("God [the Father] almighty").map((one) => one.word),
    ).toEqual(["god", "the", "father", "almighty"]);
    expect(covered("(fire) water [earth] air")).toBe(4);
    expect(enochian("fire שלום water")).toBe("PRGE [שלום] ZIN");
    expect(enochian("привет fire")).toBe("[привет] PRGE");
    expect(enochian("æther")).toBe("[æther]");
    expect(enochian("straße")).toBe("[straße]");
    // Dee's English and glosses still drop their notes.
    expect(englishWords("Mals (P)")).toEqual(["mals"]);
    // Enochian into English: a word in another script is not found, and
    // near nothing.
    const { tokens } = translator.toEnglish("OL straße SONF שלום");
    expect(tokens.map((one) => one.input)).toEqual([
      "OL",
      "straße",
      "SONF",
      "שלום",
    ]);
    expect(tokens[1]).toMatchObject({ readings: [], nearest: [] });
    expect(tokens[3]).toMatchObject({ readings: [], nearest: [] });
    // And the guess counts it, on the English side.
    expect(translator.guessDirection("fire שלום water")).toMatchObject({
      language: "english",
    });
  });

  it("L1: reads a closing quote after an s as a quote while one is open", () => {
    const possessive = (text: string) =>
      englishTokens(text)
        .filter((one) => one.possessive)
        .map((one) => one.surface);
    expect(possessive("I said 'yes' to him")).toEqual([]);
    expect(possessive("He said ‘the heavens’ fall")).toEqual([]);
    expect(possessive("'Open the gates' said God")).toEqual([]);
    expect(possessive("the angels' song")).toEqual(["angels'"]);
    expect(possessive("'tis God's will")).toEqual(["God's"]);
    // An elision's apostrophe is its word's, and opens no quote.
    expect(possessive("'Tis the angels' song")).toEqual(["angels'"]);
    expect(possessive("'Twas the angels' song")).toEqual(["angels'"]);
    expect(enochian("'Tis the angels' song")).toBe("['Tis] ·G4 LUIAHE MERIFRI");
    // Nothing moves: the forms keep the English order.
    const spans = translator
      .toEnochian("I said 'yes' to him")
      .tokens.map((one) => one.span[0]);
    expect(spans).toEqual([...spans].sort((a, b) => a - b));
  });

  it("L2: keeps do, will and shall where they are not auxiliaries", () => {
    const kinds = (text: string) =>
      translator
        .toEnochian(text)
        .tokens.map((one) => `${one.english}:${one.kind}`);
    const law = kinds("Do what thou wilt shall be the whole of the law");
    expect(law[0]).toBe("Do:form");
    expect(law).toContain("wilt:gap");
    expect(law).toContain("shall be:form");
    expect(kinds("thy will be done")).toContain("will:gap");
    expect(enochian("his will is law")).toBe("[will] TOX I OHORELA");
    expect(kinds("the will to live")).toContain("will:gap");
    // Still auxiliaries before a verb, "not" or a subject.
    expect(enochian("don't go")).toBe("·G16 IP [go]");
    expect(enochian("Will you teach us")).toMatch(/^·G16 NONCF/);
    expect(enochian("Who shall open the house")).toMatch(/·G16 ODO SALMAN$/);
    expect(enochian("Many thousands will come")).toMatch(/·G16 NIIS$/);
    // As at HEAD: after "that", "many", "some" or "this", before a noun
    // subject, a preposition or a comma, still an auxiliary.
    for (const text of [
      "the light that will shine",
      "the fire that shall burn",
      "many will come",
      "some shall die",
      "this will be",
      "Do men die",
      "Do angels sing",
      "Shall angels sing",
      "Will light come",
      "the light will in time come",
      "and he will, in the end, come",
    ])
      expect(
        translator
          .toEnochian(text)
          .tokens.some(
            (one) =>
              one.kind === "chip" &&
              one.rule === "G16" &&
              /^(?:do|will|shall)$/i.test(one.english),
          ),
        text,
      ).toBe(true);
    // "shall" is never TORZUL's "RISE, SHALL", which is "shall rise".
    expect(lookupGlosses("RISE, SHALL")).toEqual(["RISE", "SHALL RISE"]);
    expect(enochian("shall rise")).toBe("TORZUL");
    // A main verb or noun takes a form only from a gloss of it alone, or
    // of its plain form.
    expect(enochian("as thou wilt")).toBe("TA ILS [wilt]");
    expect(form("did")).toMatchObject({
      form: "GNAY",
      chips: [{ kind: "tense", rule: "G16", plain: "do" }],
    });
    expect(enochian("shall")).toBe("[shall]");
    // Not fixed: "do" before a noun object is still read as an auxiliary.
    expect(enochian("I do magic")).toBe("OL ·G16 [magic]");
  });

  it("L3: reads WE's PRONOUN, OF as the possessive", () => {
    expect(dictionaryGlosses("HIM, OF")).toEqual(["HIS", "OF HIM"]);
    expect(dictionaryGlosses("HER, OF")).toEqual(["HER", "OF HER"]);
    expect(dictionaryGlosses("them, of")).toEqual(["their", "of them"]);
    expect(english("TOX")).toBe("his");
    expect(english("TILB")).toBe("her");
    expect(english("SALMAN TOX")).toBe("‹the house› his");
    expect(english("SALMANTOX")).toBe("‹the house› his");
    // English into Enochian is as before.
    expect(enochian("his house")).toBe("SALMAN TOX");
  });

  it("L4: reads only the first 500 words, each gap's nearest once", () => {
    expect(MAX_WORDS).toBe(500);
    const long = `${Array(MAX_WORDS).fill("fire").join(" ")} water`;
    expect(firstWords(long)).toEqual({
      text: Array(MAX_WORDS).fill("fire").join(" "),
      cut: true,
    });
    expect(firstWords("fire 1 2 ? water", 1)).toEqual({
      text: "fire 1 2 ?",
      cut: true,
    });
    expect(firstWords("fire water")).toEqual({
      text: "fire water",
      cut: false,
    });
    // Words joined by commas or dashes count one by one.
    const joined = Array(3000).fill("fire").join(",");
    expect(firstWords(joined)).toEqual({
      text: `${Array(MAX_WORDS).fill("fire").join(",")},`,
      cut: true,
    });
    expect(firstWords(Array(600).fill("fire").join("—")).cut).toBe(true);
    // A word gapped twice shares its nearest forms, looked up once.
    const [first, , second] = translator.toEnochian("master and master").tokens;
    if (first.kind !== "gap" || second.kind !== "gap") throw new Error("gaps");
    expect(first.nearest.length).toBeGreaterThan(0);
    expect(second.nearest).toBe(first.nearest);
  });

  it("L6: names a split the page really makes", () => {
    const [dssalman] = translator.toEnglish("DSSALMAN").tokens;
    expect(dssalman.readings[0]).toMatchObject({
      via: "split",
      rules: ["G26"],
    });
    expect(translator.joinSplits("ODSONF").map((one) => one.parts)).toEqual([
      ["OD", "SONF"],
      ["OD", "DSONF"],
    ]);
  });

  it("L7: folds the I of 'am I', and marks a lone am as carrying it", () => {
    expect(only("am I")).toMatchObject({ form: "ZIR", span: [0, 2] });
    expect(enochian("who am I")).toBe("[who] ZIR");
    const [, , am] = translator.toEnochian("I really am").tokens;
    expect(am).toMatchObject({
      form: "ZIR",
      rule: "G13",
      chips: [{ kind: "carries", word: "I" }],
    });
    expect(form("I am").chips).toEqual([]);
  });

  it("L8: reads a superlative as a near match, naming no verb rule", () => {
    expect(form("greatest")).toMatchObject({
      form: "DRILPA",
      chips: [{ kind: "base", plain: "great" }],
    });
    // Two inflections of one word: a near match, or a tense by a verb's.
    expect(form("soundest").chips).toEqual([{ kind: "base", plain: "sounds" }]);
    expect(form("completest").chips).toEqual([
      { kind: "tense", rule: "G16", plain: "completed" },
    ]);
  });

  it("L8: keeps G16 for a verb's second person in -est", () => {
    const second = (text: string) => {
      const last = translator.toEnochian(text).tokens.at(-1);
      return last?.kind === "form" ? last.chips : [];
    };
    // The gloss's word decides: a verb ("reign" by Dee's "raigneth").
    for (const [text, plain] of [
      ["thou knowest", "know"],
      ["thou dwellest", "dwell"],
      ["thou reignest", "reign"],
      ["thou speakest", "speaking"],
      ["thou visitest", "visiting"],
      ["thou, O Lord, knowest", "know"],
    ])
      expect(second(text), text).toEqual([
        { kind: "tense", rule: "G16", plain },
      ]);
    // Alone, where the gloss's word is a verb.
    expect(second("speakest")).toEqual([
      { kind: "tense", rule: "G16", plain: "speaking" },
    ]);
    expect(second("knowest")).toEqual([
      { kind: "tense", rule: "G16", plain: "know" },
    ]);
    // An adjective's superlative stays a near match, "thou" or not.
    const chipsOf = (text: string, at: number) => {
      const one = translator.toEnochian(text).tokens[at];
      return one.kind === "form" ? one.chips : [];
    };
    for (const [text, at, plain] of [
      ["thou art the greatest", 2, "great"],
      ["O thou greatest light", 2, "great"],
      ["thou brightest star", 1, "bright"],
      ["thou the strongest", 2, "strong"],
    ] as const)
      expect(chipsOf(text, at), text).toEqual([{ kind: "base", plain }]);
  });

  it("reads hers as Dee's her, as before, and no other pronoun so", () => {
    expect(enochian("the light is hers")).toBe("·G4 OLPIRT I TILB");
    expect(form("hers")).toMatchObject({ form: "TILB", rule: "G21" });
    expect(enochian("hers is the light")).toBe("TILB I ·G4 OLPIRT");
    for (const word of ["ours", "yours", "theirs", "thine", "herring"])
      expect(only(word).kind, word).toBe("gap");
  });

  it("M1/M2: takes no grammar word as an inflection's base", () => {
    for (const word of [
      "hissing",
      "hissed",
      "herring",
      "butting",
      "untilled",
      "cal",
      "marred",
      "marring",
      "canned",
    ])
      expect(only(word).kind, word).toBe("gap");
    expect(enochian("a red herring")).toBe("·G4 [red] [herring]");
    for (const [typed, gloss] of [
      ["hissing", "his"],
      ["herring", "her"],
      ["butting", "but"],
      ["untilled", "until"],
      ["cal", "called"],
      ["marred", "mars"],
      ["hers", "her"],
    ])
      expect(sameWord(typed, gloss), `${typed} ${gloss}`).toBe(false);
    // Doubling still read where English doubles.
    expect(form("equalled")).toMatchObject({ form: "PARACH" });
    expect(sameWord("marred", "mar")).toBe(true);
    expect(sameWord("travelled", "travel")).toBe(true);
    expect(sameWord("beginning", "begin")).toBe(true);
  });

  it("L9: keeps an Enochian word a gloss names out of the English", () => {
    expect(translator.guessDirection("OHIO OHIO OHIO").language).toBe(
      "enochian",
    );
    expect(isEnglishWord(lookup, "ohio")).toBe(false);
    expect(isEnglishWord(lookup, "babalon")).toBe(false);
    // Real English stays, an Enochian spelling or not.
    expect(isEnglishWord(lookup, "fire")).toBe(true);
    expect(isEnglishWord(lookup, "paid")).toBe(true);
    // Nor is "mad" English through "made".
    expect(isEnglishWord(lookup, "made")).toBe(true);
    expect(isEnglishWord(lookup, "mad")).toBe(false);
  });

  it("L11: looks up a reader's word as its own, never an inherited one", () => {
    expect(englishTokens("constructor")[0].word).toBe("constructor");
    expect(
      enochian("constructor toString hasOwnProperty __proto__ valueOf"),
    ).toBe("[constructor] [toString] [hasOwnProperty] [proto] [valueOf]");
  });
});

describe("lookup and data fixes (15 November 2026)", () => {
  /** A gap's nearest forms, as shown. */
  const nearestOf = (text: string) => {
    const one = only(text);
    if (one.kind !== "gap") throw new Error(`${text}: ${one.kind}`);
    return one.nearest.map((option) => option.form);
  };

  it("reads Casaubon's 'range' as reign in his English only", () => {
    // Key 12.2's "that range" is DSONF "that reign"; a reader's "range"
    // is a range, never SONF "Raign".
    expect(englishWords("that range")).toEqual(["that", "reign"]);
    expect(englishTokens("range")[0].word).toBe("range");
    expect(englishTokens("bee")[0].word).toBe("bee");
    expect(enochian("range")).toBe("[range]");
    expect(enochian("the range")).toBe("·G4 [range]");
    expect(form("reign").form).toBe("SONF");
    expect(form("that reign").form).toBe("DSONF");
  });

  it("reads a compass point's -ern adjective as a near match, and no other -ern", () => {
    for (const [typed, form_, plain] of [
      ["eastern", "RAAS", "east"],
      ["northern", "LUCAL", "north"],
      ["southern", "BABAGE", "south"],
    ])
      expect(form(typed)).toMatchObject({
        form: form_,
        tier: 1,
        chips: [{ kind: "base", plain }],
      });
    expect(form("western").chips).toContainEqual({
      kind: "base",
      plain: "west",
    });
    expect(enochian("stern fern concern modern")).toBe(
      "[stern] [fern] [concern] [modern]",
    );
    for (const word of ["stern", "fern", "concern", "modern", "govern"])
      expect(wordKey(word)).toBe(word);
    expect(form("govern").form).toBe("CABA");
  });

  it("files SAAIX, the stray 'Servient', as SAIX's partner", () => {
    expect(Object.hasOwn(dictionary, "Servient")).toBe(false);
    expect(dictionary.SAAIX.meanings).toEqual([
      { meaning: "Servient Angel AIR OF WATER", source: "WE" },
    ]);
    // Each of the sixteen lesser angles has four Servient Angels, each
    // in four letters and five.
    const counts = new Map<string, number>();
    for (const { meanings } of Object.values(dictionary))
      for (const { meaning } of meanings) {
        const angle = /^Servient Angel ([A-Z]+ OF [A-Z]+)(?: \(VAR\))?$/.exec(
          meaning,
        )?.[1];
        if (angle) counts.set(angle, (counts.get(angle) ?? 0) + 1);
      }
    expect(counts.size).toBe(16);
    expect(new Set(counts.values())).toEqual(new Set([8]));
  });

  it("parts meanings that ran into the next WE entry", () => {
    const meanings = (head: string) =>
      dictionary[head].meanings.map((one) => one.meaning);
    expect(meanings("BOOAPIS")).toEqual(["SERVE, LET HER SERVE THEM"]);
    expect(meanings("BORMILA")).toEqual(["ANGEL VENUS IN SATURN"]);
    expect(meanings("TILB")).toEqual(["HER, OF", "HER"]);
    expect(meanings("TIO")).toEqual(["TOP LINE OF TABLET OF 12 SQUAR"]);
    expect(meanings("PAOC")).toEqual(["Servient Angel WATER OF AIR"]);
    expect(meanings("PAOMBD")).toEqual([
      'members, her (poss."limbs"?)',
      "her members",
    ]);
    expect(meanings("RXAO")).toEqual(["Servient Angel EARTH OF EARTH"]);
    expect(meanings("RXPAO")).toEqual(["Servient Angel EARTH OF EARTH"]);
    expect(meanings("PUIM")).toEqual(["SICKLES, SHARP"]);
    expect(meanings("PURGEL")).toEqual(["FIRE OF FIRE", "of fires"]);
    expect(meanings("DIALIOAI")).toEqual(["PART IN ARN"]);
    expect(meanings("DIARI")).toEqual(["Servient Angel WATER OF AIR"]);
    expect(meanings("BZIZA")).toEqual(["Kerubic Archangel FIRE OF FIRE"]);
    expect(meanings("C")[0]).toBe("Veh (C or K)");
    expect(enochian("let her serve them")).toBe("BOOAPIS");
  });

  it("reads Dee's 'apparail'd' as -ed, and a reader's 'd as would only after a pronoun", () => {
    expect(englishWords("they are apparail'd")).toEqual([
      "they",
      "are",
      "apparelled",
    ]);
    const zonac = lookup.rows.find((row) => row.word === "ZONAC");
    expect(zonac?.words).toEqual(["they", "are", "apparelled"]);
    expect(form("they are apparelled").form).toBe("ZONAC");
    expect(englishWords("apparaild")).toEqual(["apparelled"]);
    const read = (text: string) =>
      readerTokens(lookup, text).map((one) => one.word);
    expect(read("know'st giv'n")).toEqual(["knowest", "given"]);
    // "-ed" only for a verb our English has; "would" after anything else.
    expect(read("call'd mov'd apparail'd")).toEqual([
      "called",
      "moved",
      "apparelled",
    ]);
    for (const before of [
      "I",
      "what",
      "where",
      "how",
      "why",
      "when",
      "here",
      "this",
      "everyone",
      "God",
    ])
      expect(read(`${before}'d`)).toEqual([before.toLowerCase(), "would"]);
    // As HEAD read it, a verb our English lacks is "would" too.
    expect(read("lov'd")).toEqual(["lov", "would"]);
    expect(enochian("Why'd you go")).toBe("BAGLE [would] NONCF [go]");
    // The figures count the same words the lookup reads.
    expect(givenWords(translator, "the seal call'd")).toHaveLength(3);
  });

  it("leaves WE's editorial notes out of the glosses, abbreviations read whole", () => {
    expect(lookupGlosses("KNOWLEDGE, UNDEFILED K.")).toEqual([
      "KNOWLEDGE",
      "UNDEFILED KNOWLEDGE",
    ]);
    expect(lookupGlosses("continuance, long cont.")).toEqual([
      "continuance",
      "long continuance",
    ]);
    expect(lookupGlosses("BEGINNING, THE B. OF")).toEqual([
      "BEGINNING",
      "THE BEGINNING OF",
    ]);
    expect(lookupGlosses("phrase: ‘first,the Daughter of Light’")).toEqual([
      "first",
      "the Daughter of Light",
    ]);
    expect(lookupGlosses("SPEECH FROM GOD, VAR. 4")).toEqual([
      "SPEECH FROM GOD",
    ]);
    expect(lookupGlosses("WHOSE, VAR ON 'SOBA'")).toEqual(["WHOSE"]);
    expect(lookupGlosses("FIRST - VAR ON 'ILI'")).toEqual(["FIRST"]);
    expect(lookupGlosses("anger, wrath. var on 'vonph'?")).toEqual([
      "anger",
      "wrath",
    ]);
    expect(lookupGlosses("ALT. PART IN LIN")).toEqual([]);
    expect(
      lookupGlosses("Abbreviation for Alt. Part in LIN; Angel of the East"),
    ).toEqual(["Angel of the East"]);
    expect(
      lookupGlosses("Initiation, Visitation; n.Initiate, visit; v."),
    ).toEqual(["Initiation", "Visitation", "Initiate", "visit"]);
    expect(lookupGlosses("LETTERS OF T12SQR")).toEqual([]);
    expect(lookupGlosses('given, p.t. "to give"')).toEqual(["given"]);
    // Real glosses stay, a variant's mark in brackets aside.
    expect(lookupGlosses("IN THE 24TH PART")).toEqual(["IN THE 24TH PART"]);
    expect(lookupGlosses("42")).toEqual(["42"]);
    expect(lookupGlosses("I give Ga")).toEqual(["I give Ga"]);
    // A quote left without its pair goes; an apostrophe stays.
    for (const meaning of [
      "'It ends with [the goddess] El’; ‘Completed by the goddess’",
      "‘that which you have within yourself'",
      "'is moving’; completed; ending",
      "root of ‘interiority: within, inside, self-hood', power",
    ])
      for (const gloss of lookupGlosses(meaning))
        expect(gloss, meaning).not.toMatch(/['"‘’]/);
    expect(lookupGlosses("God’s glory spread out")).toEqual([
      "God’s glory spread out",
    ]);
    expect(lookupGlosses("KING OF AIR TABLET (VAR)")).toEqual([
      "KING OF AIR TABLET",
    ]);
    // A letter's name, with "or" between its letters, or after a letter.
    expect(lookupGlosses("Veh (C or K)")).toEqual([]);
    expect(lookupGlosses("U Val (U, V, W)")).toEqual([]);
    expect(dictionaryGlosses("Veh (C or K)")).toEqual(["Veh"]);
    // None reaches the index.
    const words = new Set(
      [lookup.tiers.literal, lookup.tiers.plain].flatMap((tiers) =>
        tiers.flatMap((tier) =>
          [...tier.values()].flat().flatMap((hit) => hit.words),
        ),
      ),
    );
    for (const note of ["var", "cont", "t12sqr", "phrase", "abbreviation"])
      expect(words.has(note), note).toBe(false);
  });

  it("reads WE's 'NOUN, ADJECTIVE' as one meaning where Dee writes it so", () => {
    const { deePairs } = lookup;
    expect(lookupGlosses("SICKLES, SHARP", deePairs)).toEqual([
      "SICKLES",
      "SHARP SICKLES",
    ]);
    expect(lookupGlosses("SICKLES, SHARP")).toEqual(["SICKLES", "SHARP"]);
    for (const [meaning, inverted] of [
      ["STONE, BARREN", "BARREN STONE"],
      ["dwellings, living", "living dwellings"],
      ["towers, strong", "strong towers"],
      ["THINGS, ALL", "ALL THINGS"],
    ])
      expect(lookupGlosses(meaning, deePairs)).toContain(inverted);
    // Two meanings stay two where Dee has no such phrase.
    expect(lookupGlosses("midday, noon", deePairs)).toEqual(["midday", "noon"]);
    expect(lookupGlosses("WINDS, MANIFOLD", deePairs)).toEqual([
      "WINDS",
      "MANIFOLD",
    ]);
    expect(enochian("sharp sickles")).toBe("PUIM");
    expect(only("sharp").kind).toBe("gap");
    expect(english("PUIM")).toBe("sickles");
  });

  it("reads a letter's name only where the word has no other meaning", () => {
    expect(english("C")).toBe("o");
    expect(english("C NOQOD")).toMatch(/^o /);
    expect(english("S")).toBe("fourth");
    // A Key word, or a letter with no other meaning, as before.
    expect(english("A")).toBe("i");
    expect(english("B")).toBe("pa");
    expect(english("P")).toBe("eight");
  });

  it("shows a dictionary-only form as its headword, in capitals", () => {
    expect(lookup.display.get("FATESGED")).toBe("FATESGED");
    expect(lookup.display.get("ONPHE")).toBe("ONPHE");
    expect(lookup.display.get("LVTVDAH")).toBe("LUTUDAH");
    // Of two headwords, the one written plain; WE's division otherwise.
    expect(lookup.display.get("ABAI")).toBe("ABAI");
    expect(lookup.display.get("ASOBAM")).toBe("A-SOBAM");
    // A Key word by Casaubon's spelling, not its fold.
    expect(lookup.display.get("IPVRAN")).toBe("IPURAN");
    expect(word("FATESGED").readings[0].words[0].word).toBe("FATESGED");
    // The headword whose meaning matched, and the entry it opens.
    expect(form("thrice great")).toMatchObject({
      form: "LUTUDAH",
      entries: ["lutudah"],
    });
    expect(form("begotten").alternatives).toContainEqual(
      expect.objectContaining({ form: "ONPHE", entries: ["onphe"] }),
    );
    expect(form("attacking")).toMatchObject({
      form: "A-BAI",
      entries: ["A-BAI"],
    });
  });

  it("gives a preposition or conjunction only nearest forms of grammar words (decision 12)", () => {
    expect(nearestOf("yet")).toEqual([]);
    expect(nearestOf("from")).toEqual([]);
    expect(nearestOf("through")).toEqual([]);
    expect(nearestOf("down")).toEqual([]);
    expect(nearestOf("under")).toEqual(["CASARMI", "OROCH", "CASARMAN"]);
    // A content word's are as before.
    expect(nearestOf("show")).toEqual(["ZAMRAN"]);
    expect(nearestOf("master")[0]).toBe("GEIAD");
  });
});
