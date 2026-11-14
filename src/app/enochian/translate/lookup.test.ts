import { readFileSync } from "node:fs";
import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import { englishTokens, wordKey } from "./english.ts";
import { cleanGloss, dictionaryGlosses } from "./glosses.ts";
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
import { type SpellingStats, toEnglish } from "./toEnglish.ts";

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
    expect(englishTokens(text).map((one) => one.word)).toEqual(["light"]);
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
      chips: [{ kind: "carries", preposition: "in" }],
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
    // The self-consistency figure is step D's; this guards against a
    // collapse, near the spike's 944 of 1,054.
    let total = 0;
    let found = 0;
    for (const [, keyRows] of lookup.keyRows) {
      const { tokens } = translator.toEnochian(
        keyRows.map((row) => row.english).join(" "),
      );
      let at = 0;
      for (const row of keyRows) {
        const width = englishTokens(row.english).length;
        const [from, to] = [at, at + width];
        at = to;
        if (!row.word || !row.core.length) continue;
        total++;
        if (
          tokens.some(
            (one) =>
              one.kind === "form" &&
              one.span[0] < to &&
              one.span[1] > from &&
              lookup.display.get(row.folded) === one.form,
          )
        )
          found++;
      }
    }
    expect(total).toBe(1054);
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
      ...Object.keys(dictionary),
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
