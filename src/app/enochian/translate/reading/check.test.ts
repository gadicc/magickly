import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import { buildKeysTable } from "../keysTable.ts";
import { createTranslator } from "../lookup.ts";
import {
  type CheckedWord,
  checkReading,
  englishIn,
  hasLink,
  isReadable,
  MAX_ENGLISH_CHARS,
  MAX_ENGLISH_WORDS,
  MAX_ITEMS_PER_WORD,
} from "./check.ts";
import type { ReadingItem } from "./item.ts";

// The real lookup over our dictionary and Keys, as the page builds it.
const translator = createTranslator(buildKeysTable(), dictionary);

type Item = Partial<ReadingItem> & Pick<ReadingItem, "target">;

/** An item on word 1, attested unless said otherwise. */
const item = (one: Item): ReadingItem => ({
  source: "",
  basis: "attested",
  token: 1,
  ...one,
});

/** The rows for a passage and its items. */
const check = (passage: string, ...items: Item[]) =>
  checkReading(translator, { passage, items: items.map(item) }).words;

/** The one row of a one-word passage. */
const one = (passage: string, ...items: Item[]): CheckedWord => {
  const words = check(passage, ...items);
  expect(words).toHaveLength(1);
  return words[0];
};

const headword = (name: string) => ({ kind: "headword", headword: name });

describe("the reading's check (plan 081, S6)", () => {
  it("confirms a reading whose source is the word's and whose English is in it", () => {
    expect(one("SONF", { target: "reign", ref: "SONF" })).toEqual({
      word: "SONF",
      state: "confirmed",
      english: "reign",
      sources: [headword("SONF")],
    });
    // Basis derived alike.
    expect(
      one("SONF", { target: "reigns", basis: "derived", ref: "SONF" }).state,
    ).toBe("confirmed");
  });

  it("reads a headword ref in the forms a model writes", () => {
    for (const ref of [
      "SONF",
      "dictionary: SONF",
      "'SONF'",
      "SONF (dictionary)",
    ])
      expect(one("SONF", { target: "reign", ref })).toMatchObject({
        state: "confirmed",
        sources: [headword("SONF")],
      });
  });

  it("confirms by a Key row, comparing Dee's spelling folded", () => {
    // Key 1.2 is SONF "Raign"; Key 2.3 is ZONG "of the windes".
    for (const ref of ["1.2", "Key 1.2", "Key 1, row 2"])
      expect(one("SONF", { target: "reign", ref })).toMatchObject({
        state: "confirmed",
        sources: [{ kind: "row", key: 1, row: 2, word: "SONF" }],
      });
    expect(
      one("ZONG", { target: "of the winds", ref: "Key 2.3" }),
    ).toMatchObject({
      state: "confirmed",
      sources: [{ kind: "row", key: 2, row: 3, word: "ZONG" }],
    });
  });

  it("accepts the lookup's folds: C/K, I/Y, U/V/W", () => {
    expect(one("KAOSGO", { target: "of the earth", ref: "CAOSGO" })).toEqual({
      word: "KAOSGO",
      state: "confirmed",
      english: "of the earth",
      sources: [headword("CAOSGO")],
    });
    expect(one("BALIE", { target: "of salt", ref: "BALYE" }).state).toBe(
      "confirmed",
    );
    for (const typed of ["GOHVLIM", "GOHWLIM"])
      expect(
        one(typed, { target: "it is said", ref: "GOHULIM" }),
      ).toMatchObject({
        word: typed,
        state: "confirmed",
        sources: [headword("GOHULIM")],
      });
  });

  it("accepts Crowley's Golden Dawn forms and Leitch's spellings", () => {
    // Crowley's vaoresaji is Dee's VORSG (Key 1.3).
    expect(
      one("vaoresaji", { target: "over you", ref: "VORSG" }),
    ).toMatchObject({
      word: "vaoresaji",
      state: "confirmed",
      sources: [headword("VORSG")],
    });
    expect(one("vaoresaji", { target: "over you", ref: "1.3" }).state).toBe(
      "confirmed",
    );
    // Leitch's PRGEL is Dee's PURGEL (Key 9.3).
    expect(one("PRGEL", { target: "of fires", ref: "9.3" })).toMatchObject({
      state: "confirmed",
      sources: [{ kind: "row", key: 9, row: 3, word: "PURGEL" }],
    });
    expect(one("PRGEL", { target: "fire", ref: "PURGEL" }).state).toBe(
      "confirmed",
    );
  });

  it("takes a Crowley form only whole, never one of its spaced parts", () => {
    // Key 4.32 is TALO "as the first", Crowley's "ta el-o"; 4.39 is
    // ZIRENAIAD, his "zodir e-na-IAD"; 4.40 DSI, his "das iod".
    expect(one("TA", { target: "first", ref: "4.32" })).toMatchObject({
      state: "unconfirmed",
      sources: [],
    });
    expect(one("ZODIR", { target: "Lord God", ref: "4.39" })).toMatchObject({
      state: "unconfirmed",
      sources: [],
    });
    // IOD is no word of ours: the model's guess, with no source.
    expect(one("IOD", { target: "which is", ref: "4.40" })).toEqual({
      word: "IOD",
      state: "guess",
      english: "which is",
      sources: [],
    });
    // Whole, his spaced form spans DSI and OD (Key 4.40 and 4.41): one
    // item citing one of them reads half of it, so it settles nothing.
    expect(one("das iod", { target: "which is", ref: "4.40" })).toEqual({
      word: "das iod",
      state: "unconfirmed",
      english: "which is",
      sources: [],
    });
  });

  it("takes a headword for a word only when it opens that word alone", () => {
    // The lookup opens TA and GE for Dee's TAGE (Key 2.37, "as is not"):
    // GE's "not, only" is a part's, not the word's.
    expect(one("TAGE", { target: "not, only", ref: "GE" })).toMatchObject({
      state: "unconfirmed",
      sources: [],
    });
    for (const [word, ref, target] of [
      ["TALO", "LO", "the first"],
      ["THILNOS", "OS", "12"],
      ["NORMOLAP", "MOLAP", "men"],
    ])
      expect(one(word, { target, ref })).toMatchObject({
        state: "unconfirmed",
        sources: [],
      });
    // Its row is the word's; its parts, cited part by part, are a join.
    expect(one("TAGE", { target: "as is not", ref: "2.37" }).state).toBe(
      "confirmed",
    );
    expect(
      one("TAGE", { target: "as", ref: "TA" }, { target: "not", ref: "GE" }),
    ).toEqual({
      word: "TAGE",
      state: "confirmed",
      english: "as not",
      sources: [headword("TA"), headword("GE")],
    });
  });

  it("needs a grammar-only reading to have the gloss's words", () => {
    // DS is "WHICH", "AND" and "THAT" in the dictionary.
    expect(one("DS", { target: "which", ref: "DS" }).state).toBe("confirmed");
    expect(one("DS", { target: "and", ref: "DS" }).state).toBe("confirmed");
    // "of the" is not CAOSGO's "earth, of the", nor Key 8.24's "of the earth".
    expect(one("CAOSGO", { target: "of the", ref: "CAOSGO" })).toMatchObject({
      state: "unconfirmed",
      sources: [headword("CAOSGO")],
    });
    expect(one("CAOSGO", { target: "of the", ref: "8.24" }).state).toBe(
      "unconfirmed",
    );
  });

  it("confirms a negation only where the gloss has the same one", () => {
    expect(one("SONF", { target: "not reign", ref: "SONF" }).state).toBe(
      "unconfirmed",
    );
    for (const target of ["they shall not reign", "don't reign", "never reign"])
      expect(one("SONF", { target, ref: "1.2" }).state).toBe("unconfirmed");
    // Key 1.58 is IPAM "is not".
    expect(one("IPAM", { target: "is not", ref: "1.58" }).state).toBe(
      "confirmed",
    );
    expect(one("IPAM", { target: "is never", ref: "1.58" }).state).toBe(
      "unconfirmed",
    );
  });

  it("confirms no reading that drops the gloss's negation (2H, M2)", () => {
    // Seven Key rows whose English denies: read without the denial, each is
    // the opposite of Dee's, so not confirmed; read with it, confirmed.
    for (const [ref, word, dropped, kept] of [
      ["8.27", "IPURAN", "shall see", "shall not see"],
      ["9.61", "UCIM", "they frown", "they frown not"],
      ["10.50", "PAGEIP", "rest", "rest not"],
      ["18.23", "MAOFFAS", "to be measured", "not to be measured"],
      ["19.71", "AGTOLTORN", "creature", "no creature"],
      ["19.82", "AGLTOLTORN", "one creature", "no one creature"],
      ["19.137", "RIPIR", "place", "no place"],
    ]) {
      expect(one(word, { target: dropped, ref }), ref).toMatchObject({
        state: "unconfirmed",
        english: dropped,
      });
      expect(one(word, { target: kept, ref }).state, ref).toBe("confirmed");
    }
    // A negation is compared within the sense the English meets, so other
    // senses of the gloss, with or without one, still confirm (2H review).
    for (const [word, target, ref] of [
      ["PAGEIP", "labour still", "10.50"],
      ["AG", "none", "AG"],
      ["AG", "no", "AG"],
      ["G", "only", "G"],
      ["GE", "only", "GE"],
      ["GE", "is not", "GE"],
      ["MAOFFAS", "measure", "MAOFFAS"],
      ["MAOFFAS", "not to be measured", "MAOFFAS"],
      ["RLU", "destroying", "RLU"],
      ["PANGEPI", "pouring down", "PANGEPI"],
      ["GESCO", "but with the holy Pentagram", "GESCO"],
    ])
      expect(one(word, { target, ref }).state, `${word} ${target}`).toBe(
        "confirmed",
      );
    // English within one sense never borrows another sense's negation
    // (2H review 2).
    for (const [word, target, ref] of [
      ["PAGEIP", "labour not", "10.50"],
      ["PAGEIP", "not labour still", "10.50"],
      ["PANGEPI", "not pouring down", "PANGEPI"],
      ["RLU", "not destroying", "RLU"],
      ["MAOFFAS", "not measure", "MAOFFAS"],
      ["GESCO", "not but with the holy pentagram", "GESCO"],
      // A negated sense with its negation dropped, though it stems as
      // another sense ("measure").
      ["MAOFFAS", "to be measured", "MAOFFAS"],
      ["MAOFFAS", "measured", "MAOFFAS"],
      // "without" is a negation.
      ["GEMPH", "with the water", "GEMPH"],
    ])
      expect(one(word, { target, ref }).state, `${word} ${target}`).toBe(
        "unconfirmed",
      );
    // English across senses meets the whole gloss.
    expect(
      one("PAGEIP", { target: "rest not, labour still", ref: "10.50" }).state,
    ).toBe("confirmed");
    expect(
      one("GEMPH", { target: "without the water", ref: "GEMPH" }).state,
    ).toBe("confirmed");
    const padgze = translator.lookup.dictionary
      .get("PADGZE")
      ?.meanings.map(({ meaning }) => meaning)
      .find((meaning) => /\bwithout defect\b/i.test(meaning));
    if (!padgze) throw new Error("PADGZE has no meaning without defect");
    expect(
      one("PADGZE", {
        target: padgze.replace(/\bwithout\b/gi, "with"),
        ref: "PADGZE",
      }).state,
    ).toBe("unconfirmed");
    expect(one("PADGZE", { target: padgze, ref: "PADGZE" }).state).toBe(
      "confirmed",
    );
    // A bracketed negation stays: "is (not)" is never "is".
    expect(englishIn("is", "is (not)")).toBe(false);
    expect(englishIn("is not", "is (not)")).toBe(true);
    expect(englishIn("I", "I, my (of me)")).toBe(true);
    // A negation of another kind is no match either.
    expect(one("RIPIR", { target: "never a place", ref: "19.137" }).state).toBe(
      "unconfirmed",
    );
  });

  it("confirms no English with a letter or symbol the check doesn't read (2H, M1)", () => {
    // Each would meet "reign" by its readable words alone.
    for (const target of [
      "\u039D\u039F\u03A4 reign",
      "\u043D\u0435 reign",
      "reign \u4E0D\u662F",
      "reign (\u05DC\u05D0)",
      "reign \u2260 \u00AC",
      "reign +",
      "re\u00EFgn",
    ]) {
      expect(isReadable(target), target).toBe(false);
      expect(one("SONF", { target, ref: "SONF" }), target).toMatchObject({
        state: "unconfirmed",
        english: target.normalize("NFKC"),
        sources: [headword("SONF")],
      });
    }
    // "&" is read as "and", as our glosses use it.
    expect(
      one("CORAXO", { target: "thunders of judgment & wrath", ref: "CORAXO" }),
    ).toMatchObject({
      state: "confirmed",
      english: "thunders of judgment and wrath",
    });
    expect(
      one("BEN", { target: "angel who appeared to D. & K.", ref: "BEN" }).state,
    ).toBe("confirmed");
    // Punctuation that only separates words is read.
    expect(isReadable("reign, (rule); \u201Cover\u201D you - I/my: yes!")).toBe(
      true,
    );
  });

  it("confirms every Key row read with its own English", () => {
    const failed: string[] = [];
    let rows = 0;
    for (const keyRows of translator.lookup.keyRows.values())
      for (const row of keyRows) {
        const word = row.word || row.gd;
        // Six rows have no word or no English to read.
        if (!word || !row.english) continue;
        rows++;
        const words = check(word, { target: row.english, ref: row.id });
        if (words.length !== 1 || words[0].state !== "confirmed")
          failed.push(row.id);
      }
    expect(rows).toBe(1106);
    expect(failed).toEqual([]);
  });

  it("leaves a known word's reading unconfirmed when the check can't settle it", () => {
    // English not in the gloss: the source is ours, so it is shown.
    expect(one("SONF", { target: "the sky", ref: "SONF" })).toEqual({
      word: "SONF",
      state: "unconfirmed",
      english: "the sky",
      sources: [headword("SONF")],
    });
    // A source we don't have, another word's, a malformed ref or none.
    for (const ref of [
      "SONFAX",
      "CAOSGO",
      "Key 1.3",
      "Key 99.1",
      "see the Keys",
      undefined,
    ])
      expect(one("SONF", { target: "reign", ref })).toMatchObject({
        state: "unconfirmed",
        sources: [],
      });
    // A derived reading whose source doesn't exist.
    expect(
      one("SONF", { target: "reign", basis: "derived", ref: "SONFIR" }),
    ).toMatchObject({ state: "unconfirmed", sources: [] });
    // A coinage is never confirmed, though its source is the word's.
    expect(
      one("SONF", { target: "reign", basis: "coined", ref: "SONF" }).state,
    ).toBe("unconfirmed");
  });

  it("marks a reading of a word not in our data as the model's guess, shown", () => {
    expect(one("ZXQX", { target: "a bird", ref: "ZXQX" })).toEqual({
      word: "ZXQX",
      state: "guess",
      english: "a bird",
      sources: [],
    });
    // An attested claim with a ref of a word we have, but not this one.
    expect(one("ZXQX", { target: "reign", ref: "SONF" })).toMatchObject({
      state: "guess",
      sources: [],
    });
    for (const basis of ["derived", "coined"] as const)
      expect(one("ZXQX", { target: "a bird", basis }).state).toBe("guess");
  });

  it("gives no reading for no item, basis unknown, or no English", () => {
    expect(one("SONF")).toEqual({ word: "SONF", state: "none", sources: [] });
    expect(
      one("SONF", { target: "reign", basis: "unknown", ref: "SONF" }),
    ).toEqual({ word: "SONF", state: "none", sources: [] });
    for (const target of ["", "  ", "unknown", "[Unknown]", "?"])
      expect(one("ZXQX", { target, basis: "coined" }).state).toBe("none");
  });

  it("gives exactly one row per word, the lookup's, in order", () => {
    const words = check(
      "ol sonf vorsg",
      { target: "I", ref: "1.1", token: 1 },
      { target: "over you", ref: "VORSG", token: 3 },
    );
    expect(words.map((row) => [row.word, row.state])).toEqual([
      ["ol", "confirmed"],
      ["sonf", "none"],
      ["vorsg", "confirmed"],
    ]);
    // Crowley's spaced form is one word of the lookup's.
    expect(check("das iod").map((row) => row.word)).toEqual(["das iod"]);
  });

  it("drops items that name no word of the passage", () => {
    const { words, dropped } = checkReading(translator, {
      passage: "SONF CAOSGO",
      items: [
        item({ target: "reign", ref: "SONF", token: undefined }),
        item({ target: "reign", ref: "SONF", token: 0 }),
        item({ target: "reign", ref: "SONF", token: 3 }),
        item({ target: "reign", ref: "SONF", token: 1.5 }),
        item({ target: "of the earth", ref: "CAOSGO", token: 2 }),
      ],
    });
    expect(dropped).toBe(4);
    expect(words.map((row) => row.state)).toEqual(["none", "confirmed"]);
  });

  it("takes the lookup's own gloss for a row it reads, as a Key 19 Aethyr", () => {
    const rows = translator.lookup.keyRows.get(19) ?? [];
    const slot = rows.find((row) => row.aethyrSlot);
    if (!slot) throw new Error("Key 19 has no Aethyr slot");
    // The Call of the Aethyrs with the second Aethyr, ARN, in its slot.
    const before = rows.slice(0, slot.row - 1).map((row) => row.word);
    const words = check(`${before.join(" ")} ARN`, {
      target: "in the second air",
      ref: slot.id,
      token: before.length + 1,
    });
    // Named as the Aethyr read there, not the slot's LIL.
    expect(words.at(-1)).toEqual({
      word: "ARN",
      state: "confirmed",
      english: "in the second air",
      sources: [
        { kind: "row", key: 19, row: slot.row, word: "ARN", aethyr: 2 },
      ],
    });
    // The slot's own English is the first Aethyr's, LIL's, not ARN's.
    for (const target of ["in the first air", "in the third air"])
      expect(
        check(`${before.join(" ")} ARN`, {
          target,
          ref: slot.id,
          token: before.length + 1,
        }).at(-1)?.state,
      ).toBe("unconfirmed");
    // LIL's headword is not another Aethyr's, in the slot or out of it.
    const zax = checkReading(translator, {
      passage: `${before.join(" ")} ZAX`,
      items: [
        item({ target: "first aethyr", ref: "LIL", token: before.length + 1 }),
      ],
    }).words.at(-1);
    expect(zax).toMatchObject({
      word: "ZAX",
      state: "unconfirmed",
      sources: [],
    });
    // Out of the slot, an Aethyr's name is not the slot's row.
    expect(
      one("ZAX", { target: "in the first air", ref: slot.id }),
    ).toMatchObject({ state: "unconfirmed", sources: [] });
    // LIL in its slot reads the slot's own English.
    expect(
      check(`${before.join(" ")} LIL`, {
        target: "in the first air",
        ref: slot.id,
        token: before.length + 1,
      }).at(-1),
    ).toMatchObject({
      state: "confirmed",
      sources: [{ kind: "row", key: 19, row: slot.row, word: "LIL" }],
    });
  });

  describe("joins", () => {
    it("confirms parts as the lookup reads the word, G27's shared letter too", () => {
      // The lookup splits ODSONF as OD + SONF (G30) and OD + DSONF (G27).
      expect(
        one(
          "ODSONF",
          { target: "and", ref: "OD" },
          { target: "reign", ref: "1.2" },
        ),
      ).toEqual({
        word: "ODSONF",
        state: "confirmed",
        english: "and reign",
        sources: [
          headword("OD"),
          { kind: "row", key: 1, row: 2, word: "SONF" },
        ],
      });
      expect(
        one(
          "ODSONF",
          { target: "and", ref: "OD" },
          { target: "which reign", ref: "4.11" },
        ).state,
      ).toBe("confirmed");
      // Crowley's "das iod" spans Dee's DSI and OD (Key 4.40 and 4.41).
      expect(
        one(
          "das iod",
          { target: "which is", ref: "4.40" },
          { target: "and", ref: "4.41" },
        ).state,
      ).toBe("confirmed");
    });

    it("confirms no join the lookup doesn't read so", () => {
      // DSONF is Dee's own word, read whole: DS + SONF is not its reading.
      expect(
        one(
          "DSONF",
          { target: "which", ref: "DS" },
          { target: "reign", ref: "SONF" },
        ),
      ).toMatchObject({ state: "unconfirmed", sources: [] });
      // Parts in the wrong order, or another word's.
      expect(
        one(
          "ODSONF",
          { target: "reign", ref: "SONF" },
          { target: "and", ref: "OD" },
        ).state,
      ).toBe("unconfirmed");
      expect(
        one(
          "ODSONF",
          { target: "and", ref: "OD" },
          { target: "of the earth", ref: "CAOSGO" },
        ),
      ).toEqual({
        word: "ODSONF",
        state: "unconfirmed",
        english: "and of the earth",
        sources: [],
      });
    });

    it("makes a word the lookup doesn't read the model's guess, with no source", () => {
      // Our spellings would rebuild these; the lookup reads none of them.
      for (const [word, parts] of [
        [
          "CAOSGOMADRIAX",
          [
            ["of the earth", "CAOSGO"],
            ["heaven", "MADRIAX"],
          ],
        ],
        [
          "LDS",
          [
            ["first", "L"],
            ["third", "D"],
            ["fourth", "S"],
          ],
        ],
        [
          "LDT",
          [
            ["first", "L"],
            ["third", "D"],
            ["is", "T"],
          ],
        ],
        [
          "SONFSONF",
          [
            ["reign", "SONF"],
            ["reign", "1.2"],
          ],
        ],
      ] as const)
        expect(
          one(word, ...parts.map(([target, ref]) => ({ target, ref }))),
        ).toMatchObject({ state: "guess", sources: [] });
    });

    it("shows the sources of the lookup's parts when a part's English fails", () => {
      expect(
        one(
          "ODSONF",
          { target: "and", ref: "OD" },
          { target: "earth", ref: "SONF" },
        ),
      ).toMatchObject({
        state: "unconfirmed",
        sources: [headword("OD"), headword("SONF")],
      });
      // A part with no reading, or no source, settles nothing.
      expect(
        one(
          "ODSONF",
          { target: "and", ref: "OD" },
          { target: "", basis: "unknown" },
        ),
      ).toMatchObject({ state: "unconfirmed", english: "and", sources: [] });
    });

    it("checks no more than a few items on one word", () => {
      const many = Array.from({ length: MAX_ITEMS_PER_WORD + 1 }, () => ({
        target: "and",
        ref: "OD",
      }));
      expect(one("ODSONF", ...many)).toMatchObject({
        state: "unconfirmed",
        english: Array(MAX_ITEMS_PER_WORD + 1)
          .fill("and")
          .slice(0, 10)
          .join(" "),
        sources: [],
      });
      expect(one("ZXQX", ...many).state).toBe("guess");
    });
  });

  it("checks a worst case of 150 words quickly", () => {
    // S3 admits at most 150 words, all but 10 of them ours. Here 140 of
    // Dee's and 10 a letter off his (the lookup's slowest path, its nearest
    // spellings, which alone takes about 110 ms for 150 such words), each
    // with many items and refs.
    const dee = [
      ...new Set(
        translator.lookup.rows
          .map((row) => row.folded)
          .filter((one) => one.length >= 4),
      ),
    ];
    const words = [
      ...dee.slice(0, 140),
      ...dee.slice(140, 150).map((one) => `${one}Q`),
    ];
    const items = words.flatMap((_, at) =>
      Array.from({ length: 20 }, () =>
        item({ target: "first one two", ref: "L", token: at + 1 }),
      ),
    );
    const input = {
      passage: words.join(" "),
      items,
      sentence: "first ".repeat(600),
    };
    checkReading(translator, input);
    const started = performance.now();
    const { words: rows } = checkReading(translator, input);
    const took = performance.now() - started;
    expect(rows).toHaveLength(150);
    expect(took).toBeLessThan(100);
    // And the slowest join: many items on one long word of one letter.
    const g = {
      passage: "G".repeat(53),
      items: Array.from({ length: 28 }, () =>
        item({ target: "first", ref: "G" }),
      ),
    };
    checkReading(translator, g);
    const again = performance.now();
    checkReading(translator, g);
    expect(performance.now() - again).toBeLessThan(100);
  });

  it("never shows the model's source or ref text, only our data's names", () => {
    const { words } = checkReading(translator, {
      passage: "sonf zxqx",
      items: [
        item({
          source: "MODELSOURCE",
          target: "reign",
          ref: "dictionary: sonf",
        }),
        item({
          source: "<b>MODELSOURCE</b>",
          target: "a bird",
          ref: "MODELREF",
          token: 2,
        }),
      ],
    });
    const shown = JSON.stringify(words);
    expect(shown).not.toContain("MODELSOURCE");
    expect(shown).not.toContain("MODELREF");
    expect(words[0]).toMatchObject({
      word: "sonf",
      sources: [headword("SONF")],
    });
    expect(words[1].word).toBe("zxqx");
  });

  it("cuts the model's English to ten words, saying so, as plain text", () => {
    const long =
      "one two three four five six seven eight nine ten eleven twelve";
    const row = one("ZXQX", { target: long });
    expect(row.english?.split(" ")).toHaveLength(MAX_ENGLISH_WORDS);
    expect(row.english).toBe(
      "one two three four five six seven eight nine ten",
    );
    expect(row.cut).toBe(true);
    expect(one("ZXQX", { target: "a‮bird\n\u0000here" })).toMatchObject({
      english: "a bird here",
    });
    expect(one("ZXQX", { target: "a bird" }).cut).toBeUndefined();
  });

  it("cuts the model's English to a number of characters too (2H, S2)", () => {
    const row = one("ZXQX", { target: "a".repeat(3006) });
    expect(Array.from(row.english ?? "")).toHaveLength(MAX_ENGLISH_CHARS);
    expect(row.cut).toBe(true);
    // Cut by character, never in the middle of one.
    const wide = one("ZXQX", { target: "a\u{1D11E}".repeat(200) });
    expect(wide.english).toBe("a\u{1D11E}".repeat(MAX_ENGLISH_CHARS / 2));
  });

  it("checks the English it shows: look-alike letters are letters", () => {
    for (const target of [
      "\uFF4E\uFF4F\uFF54 reign",
      "\u{1D427}\u{1D428}\u{1D42D} reign",
      "\u24DD\u24DE\u24E3 reign",
      "reign \uFB00",
      "reign \uFF4F\uFF56\uFF45\uFF52 \uFF48\uFF45\uFF4C\uFF4C",
    ])
      expect(one("SONF", { target, ref: "SONF" }).state).toBe("unconfirmed");
    expect(
      one("SONF", {
        target: "reign \uFF4E\uFF45\uFF56\uFF45\uFF52",
        ref: "1.2",
      }),
    ).toEqual({
      word: "SONF",
      state: "unconfirmed",
      english: "reign never",
      sources: [{ kind: "row", key: 1, row: 2, word: "SONF" }],
    });
    // And a look-alike reading of the gloss is the gloss.
    expect(
      one("SONF", { target: "\uFF52\uFF45\uFF49\uFF47\uFF4E", ref: "SONF" }),
    ).toMatchObject({ state: "confirmed", english: "reign" });
  });

  it("shows nothing of English with a link: it is no reading", () => {
    for (const target of [
      "visit https://evil.example now",
      "see evil.xyz",
      "see evil\uFF0Ecom",
      "write to a@b",
      "www.example",
      "javascript:alert(1)",
    ]) {
      expect(one("ZXQX", { target, basis: "coined" })).toEqual({
        word: "ZXQX",
        state: "none",
        sources: [],
      });
      expect(one("SONF", { target: `reign ${target}`, ref: "SONF" })).toEqual({
        word: "SONF",
        state: "none",
        sources: [],
      });
    }
    // Ordinary English is no link.
    expect(
      one("ZXQX", { target: "a bird, e.g. a crow; i.e. black" }).state,
    ).toBe("guess");
  });

  describe("the sentence (S7)", () => {
    const passage = "ol sonf vorsg";
    const items = [
      item({ target: "I", ref: "1.1", token: 1 }),
      item({ target: "reign", ref: "1.2", token: 2 }),
      item({ target: "over you", ref: "1.3", token: 3 }),
    ];
    const sentence = (text?: string) =>
      checkReading(translator, { passage, items, sentence: text }).sentence;

    it("shows a sentence drawn from the readings, as plain text", () => {
      expect(sentence("I reign\n over you.")).toMatchObject({
        shown: true,
        text: "I reign over you.",
      });
    });

    it("withholds one that isn't, one that's missing, too long or a link", () => {
      // Withheld, it carries the reason and counts, none of the model's words.
      expect(sentence("The cat sat on a mat with a hat.")).toEqual({
        shown: false,
        withheld: "too few supported",
        contentWords: 4,
        supported: 0,
      });
      expect(sentence(undefined)).toMatchObject({
        shown: false,
        withheld: "no sentence",
      });
      expect(sentence("I reign over you. ".repeat(4))).toMatchObject({
        shown: false,
        withheld: "too long",
      });
      expect(
        sentence("I reign over you at https://reign.example"),
      ).toMatchObject({ shown: false, withheld: "link" });
      for (const text of [
        "I reign over you at reign.com",
        "I reign over you at reign.xyz",
        "I reign over you: javascript:alert(1)",
      ])
        expect(sentence(text)).toMatchObject({
          shown: false,
          withheld: "link",
        });
      // Abbreviations and decimals are no link.
      expect(hasLink("evil\uFF0Ecom")).toBe(true);
      for (const text of ["e.g. this", "i.e. that", "U.S.A.", "3.5 cubits"])
        expect(hasLink(text)).toBe(false);
    });

    it("takes evidence only from confirmed readings and our glosses (2H, S3)", () => {
      // "salt" is no gloss of these words: neither a guess nor no reading
      // is evidence for it.
      const read = (basis: ReadingItem["basis"]) =>
        checkReading(translator, {
          passage: "zxqx",
          items: [item({ target: "salt", basis })],
          sentence: "Salt.",
        }).sentence.shown;
      expect(read("coined")).toBe(false);
      expect(read("unknown")).toBe(false);
      // Two coined readings of non-words can't support a sentence of their
      // own words.
      expect(
        checkReading(translator, {
          passage: "zxqx qqzx",
          items: [
            item({ target: "your account is locked", basis: "coined" }),
            item({
              target: "telephone 555 0100 now",
              basis: "coined",
              token: 2,
            }),
          ],
          sentence: "Your account is locked. Telephone 555 0100 now.",
        }).sentence,
      ).toEqual({
        shown: false,
        withheld: "too few supported",
        contentWords: 6,
        supported: 0,
      });
      // An unconfirmed reading of a word of ours is no evidence either.
      expect(
        checkReading(translator, {
          passage: "sonf",
          items: [item({ target: "salt", ref: "SONF" })],
          sentence: "Salt.",
        }).sentence.shown,
      ).toBe(false);
      // A confirmed one is.
      expect(sentence("I reign over you.").shown).toBe(true);
    });

    it("withholds a sentence the check can't read, or long in characters (2H, M1, S2)", () => {
      for (const text of [
        "I reign over you, \u039D\u039F\u03A4.",
        "I \u043D\u0435 reign over you.",
        "I reign over you \u4E0D\u662F.",
        "I reign (\u05DC\u05D0) over you.",
        "I reign \u2260 \u00AC over you.",
      ])
        expect(sentence(text), text).toMatchObject({
          shown: false,
          withheld: "unreadable",
        });
      // Padded past its characters with what the check reads as no word.
      for (const pad of [
        "\u00E9".repeat(200),
        "-".repeat(200),
        "a".repeat(200),
      ])
        expect(sentence(`I reign over you ${pad}`)).toMatchObject({
          shown: false,
          withheld: "too long",
        });
    });
  });
});
