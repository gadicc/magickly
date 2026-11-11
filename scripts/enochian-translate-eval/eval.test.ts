import dictionaryData from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import letters from "magick-data/enochian/letters";
import { describe, expect, it } from "vitest";
import {
  alignItems,
  checkContext,
  checkItem,
  decipherItem,
  parseRef,
} from "./answer.ts";
import { a1Task1, a1Task2, markHard } from "./baseline.ts";
import {
  cipher,
  ENGLISH_HOMOGRAPHS,
  encipherMeaning,
  letterNames,
  makeCipher,
} from "./cipher.ts";
import {
  serialiseContext,
  serialiseDictionary,
  serialiseRow,
  task1Input,
} from "./context.ts";
import { data, dictionary, entry, row } from "./fixtures.ts";
import {
  contentStems,
  editDistance,
  englishAgrees,
  englishWords,
  foldVariants,
  isFunctionOnly,
  meaningAgrees,
  normEnochian,
  sharesContentWord,
  stemEnglish,
} from "./normalise.ts";
import {
  figures,
  report,
  scoreFold,
  scoreTask1,
  scoreTask2,
  synonymIndex,
} from "./score.ts";
import {
  buildFold,
  buildTestSet,
  closedGaps,
  contextDictionary,
  removalRule,
  rowsFromKeys,
} from "./testset.ts";

describe("normalising", () => {
  it("folds Enochian case, U/V, I/J, hyphens, spaces and accents", () => {
    expect(normEnochian("vaoresaji")).toBe("UAORESAII");
    expect(normEnochian("DIV")).toBe(normEnochian("diu"));
    expect(normEnochian("sobrazod-ol")).toBe("SOBRAZODOL");
    expect(normEnochian("GO (LE)")).toBe("GOLE");
    expect(normEnochian("monasaçi")).toBe("MONASACI");
    // Only the plan's folds: C/K and Y/I stay apart for scoring...
    expect(normEnochian("K")).not.toBe(normEnochian("C"));
    expect(normEnochian("BALYE")).not.toBe(normEnochian("BALIE"));
    // ...but the closed book folds them, as the dictionary's search does.
    expect(foldVariants("BALYE")).toBe(foldVariants("balie"));
    expect(foldVariants("YLS")).toBe(foldVariants("ILS"));
  });

  it("folds Dee's spelling and stems English", () => {
    expect(englishWords("Raign over you")).toEqual(["reign", "over", "you"]);
    expect(contentStems("raigneth")).toEqual(contentStems("reigns"));
    expect(contentStems("brightnesse")).toEqual(contentStems("brightness"));
    expect(sharesContentWord("of him that liveth", "the living one")).toBe(
      true,
    );
    expect(sharesContentWord("live", "liveth")).toBe(true);
    expect(sharesContentWord("the Lord", "the God")).toBe(false);
  });

  it("keeps a final e that would make another word", () => {
    for (const [a, b] of [
      ["fire", "fir"],
      ["ride", "rid"],
      ["done", "don"],
      ["line", "lin"],
      ["note", "not"],
      ["made", "mad"],
    ])
      expect(stemEnglish(a)).not.toBe(stemEnglish(b));
    expect(stemEnglish("fires")).toBe(stemEnglish("fire"));
  });

  it("compares function-word English as a set of words", () => {
    expect(isFunctionOnly("is as")).toBe(true);
    expect(isFunctionOnly("the Lord")).toBe(false);
    expect(englishAgrees("I", "i")).toBe(true);
    expect(englishAgrees("I", "me")).toBe(false);
    expect(englishAgrees("in whose", "whose")).toBe(false);
    expect(englishAgrees("unto you", "to you")).toBe(true);
    expect(englishAgrees("in her", "HER, IN")).toBe(true);
    expect(englishAgrees("doth", "does")).toBe(true);
    expect(meaningAgrees("in whose", "WHOM, IN WHOSE")).toBe(true);
    expect(meaningAgrees("art", "ARE, ART (to be)")).toBe(true);
  });

  it("measures edit distance", () => {
    expect(editDistance("BALTOH", "BALTOHA")).toBe(1);
    expect(editDistance("NETAAB", "ANETAB")).toBe(2);
    expect(editDistance("", "OL")).toBe(2);
  });
});

describe("the closed book's removals", () => {
  it("removes by spelling, or containment when the shorter has 4 letters", () => {
    expect(removalRule("ZORGE", "ZORGE")).toBe("same");
    expect(removalRule("ZORGEX", "ZORGE")).toBe("contains");
    expect(removalRule("ORGE", "ZORGE")).toBe("contained");
    expect(removalRule("ORG", "ZORGE")).toBeUndefined();
    expect(removalRule("CAOSG", "ZORGE")).toBeUndefined();
  });

  it("never removes a headword the other Keys say", () => {
    const fold = buildFold(1, data);
    // ORG is inside ZORGE but has three letters; CAOSGIN neither holds
    // CAOSGO nor is held by it.
    expect(fold.removals.map((one) => one.headword).sort()).toEqual([
      "ZOR-GE",
      "ZORGE",
      "ZORGEX",
    ]);
    const why = Object.fromEntries(
      fold.removals.map((one) => [one.headword, [one.because, one.rule]]),
    );
    expect(why.ZORGE).toEqual(["ZORGE", "same"]);
    expect(why["ZOR-GE"]).toEqual(["ZORGE", "same"]);
    expect(why.ZORGEX).toEqual(["ZORGE", "contains"]);
    expect(fold.exemptions).toEqual([
      {
        headword: "CAOSG",
        because: "CAOSGO",
        rule: "contained",
        inKeys: ["2.2"],
      },
    ]);
    // OL and IAD are said in Key 2, so they are not single-Key words at all.
    expect(Object.keys(contextDictionary(fold, "closed", dictionary))).toEqual([
      "OL",
      "ORG",
      "CAOSG",
      "CAOSGIN",
      "IAD",
    ]);
    expect(contextDictionary(fold, "open", dictionary)).toBe(dictionary);
  });

  it("removes by the GD's form and across Y/I", () => {
    const fold = buildFold(1, {
      dictionary: {
        ELA: entry("FIRST"),
        BALIE: entry("salt"),
        ILS: entry("THOU, O THOU"),
        OL: entry("I"),
      },
      rows: [
        row(1, 1, "LA", "the first", "Ela"),
        row(1, 2, "BALYE", "of salt", "balie"),
        row(1, 3, "YLS", "thou", "ilasa"),
        row(2, 1, "OL", "I"),
      ],
    });
    expect(fold.removals.map((one) => one.headword).sort()).toEqual([
      "BALIE",
      "ELA",
      "ILS",
    ]);
  });

  it("uses GD forms only for exact removal, never for knowability", () => {
    const fold = buildFold(1, {
      dictionary: {
        LUSDA: entry("FEET, THEIR"),
        ELAX: entry("first of all"),
        BUSADA: entry("feet"),
      },
      rows: [
        row(1, 1, "LUSDA", "their feet", "busada"),
        row(1, 2, "LA", "the first", "Ela"),
        row(2, 1, "BUFD", "the gardens", "busada"),
      ],
    });
    // BUFD shares LUSDA's GD form, but LUSDA is still unknowable.
    expect(fold.rows.map((one) => one.knowableClosed)).toEqual([false, false]);
    // ELAX holds the GD form "ELA" but is not removed; BUSADA is the GD form
    // exactly, and Key 2's GD "busada" doesn't protect it.
    expect(fold.removals.map((one) => one.headword).sort()).toEqual([
      "BUSADA",
      "LUSDA",
    ]);
  });

  it("marks rows single-Key, knowable and in the dictionary", () => {
    const fold = buildFold(1, data);
    // 1.4 has no English: not scoreable, but it is task 1's input.
    expect(fold.rows.map((one) => one.id)).toEqual(["1.1", "1.2", "1.3"]);
    expect(fold.input.map((one) => one.id)).toEqual([
      "1.1",
      "1.2",
      "1.3",
      "1.4",
    ]);
    const flags = fold.rows.map((one) => [
      one.singleKey,
      one.knowableClosed,
      one.knowableOpen,
      one.inDictionary,
    ]);
    expect(flags).toEqual([
      [false, true, true, true],
      [true, false, true, true],
      [true, false, false, false],
    ]);
    // Key 2's lost word is said by its GD form, and is context, not test.
    expect(buildFold(2, data).rows.map((one) => one.id)).toEqual([
      "2.1",
      "2.2",
      "2.3",
    ]);
  });

  it("lists kept entries one letter from an unknowable word as gaps", () => {
    const near = { ...dictionary, ZORGI: entry("friendly") };
    const fold = buildFold(1, { dictionary: near, rows: data.rows });
    // CAOSG stays because Key 2 says it, so it is a gap too.
    expect(closedGaps(fold, near)).toEqual([
      { row: "1.2", headword: "ZORGI", form: "ZORGE", meaning: "friendly" },
      { row: "1.3", headword: "CAOSG", form: "CAOSGO", meaning: "earth" },
    ]);
  });
});

describe("the cipher", () => {
  it("round-trips to the normalised form and keeps case", () => {
    for (const word of [...Object.keys(dictionaryData), "vaoresaji", "Pire"])
      expect(normEnochian(cipher.decipher(cipher.encipher(word)))).toBe(
        normEnochian(word),
      );
    expect(cipher.encipher("Pire")).toMatch(/^[A-Z][a-z]{3}$/);
    expect(cipher.encipher("sobrazod-ol")).toMatch(/^[a-z]{8}-[a-z]{2}$/);
  });

  it("is fixed by its seed and moves every letter", () => {
    expect(makeCipher().forward).toEqual(cipher.forward);
    expect(makeCipher(1).forward).not.toEqual(cipher.forward);
    for (const [from, to] of Object.entries(cipher.forward))
      expect(to).not.toBe(from);
  });

  it("enciphers the Enochian quoted in meanings, not English homographs", () => {
    const heads = new Set(["CAOSG", "MARS", "FIRE"]);
    expect(encipherMeaning("earth, var of caosg", heads)).toBe(
      `earth, var of ${cipher.encipher("caosg")}`,
    );
    expect(encipherMeaning("Senior MARS of FIRE", heads)).toBe(
      "Senior MARS of FIRE",
    );
    // Not a headword, but named after "see".
    expect(encipherMeaning("govern, to; (see 'cab')", heads)).toBe(
      `govern, to; (see '${cipher.encipher("cab")}')`,
    );
  });

  it("enciphers the letters a meaning names", () => {
    const e = cipher.encipher;
    const none = new Set<string>();
    expect(encipherMeaning("Un (A)", none, cipher, "A")).toBe(`Un (${e("A")})`);
    expect(encipherMeaning("ENOCHIAN LETTER Z", none)).toBe(
      `ENOCHIAN LETTER ${e("Z")}`,
    );
    expect(encipherMeaning("PE, ENOCHIAN LETTER 'B'", none)).toBe(
      `PE, ENOCHIAN LETTER '${e("B")}'`,
    );
    expect(encipherMeaning("VEH, ENOCHIAN LETTER C OR K", none)).toBe(
      `VEH, ENOCHIAN LETTER ${e("C")} OR ${e("K")}`,
    );
    const names = letterNames(dictionaryData);
    expect(encipherMeaning("U Val (U, V, W)", none, cipher, "U", names)).toBe(
      `${e("U")} ${e("Val")} (${e("U")}, ${e("V")}, ${e("W")})`,
    );
    expect(encipherMeaning("Na-hath (H)", none, cipher, "H", names)).toBe(
      `${e("Na")}-${e("hath")} (${e("H")})`,
    );
    expect(encipherMeaning("HATH ENOCHIAN LETTER H", none, cipher, "NA-")).toBe(
      `${e("HATH")} ENOCHIAN LETTER ${e("H")}`,
    );
    // "hath" elsewhere is English.
    expect(encipherMeaning("he hath spoken", none, cipher, "X", names)).toBe(
      "he hath spoken",
    );
    // English single letters stay; so does "LETTERS OF …".
    expect(encipherMeaning("I, my", none, cipher, "A")).toBe("I, my");
    expect(encipherMeaning("LETTERS OF T12SQR", none)).toBe(
      "LETTERS OF T12SQR",
    );
  });

  it("hides every headword in the A2c context", () => {
    const fold = buildFold(1, data);
    const text = serialiseContext(fold, dictionary, {
      book: "open",
      cipher: true,
    });
    expect(text).toContain(
      `${cipher.encipher("CAOSGIN")}\tearth, var of ${cipher.encipher("caosg")} [WE]`,
    );
    expect(text).not.toMatch(/\bCAOSG\b|\bZORGE\b/);
    expect(task1Input(fold, { cipher: true })).toBe(
      ["OL", "ZORGE", "CAOSGO", "IAD"]
        .map((one, i) => `[${i + 1}] ${cipher.encipher(one)}`)
        .join(" "),
    );
  });
});

describe("the A2c context of the real data", () => {
  const folds = buildTestSet({
    dictionary: dictionaryData,
    rows: rowsFromKeys(keys),
  });
  const fold = folds[2];
  const headwords = new Set(Object.keys(dictionaryData).map(normEnochian));
  // Accents dropped first: the cipher drops them ("monasaçi").
  const tokens = (text: string): string[] =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[A-Za-z]+/g) ?? [];
  const entries = Object.entries(dictionaryData).map(([headword, one]) => ({
    headword,
    plain: serialiseDictionary({ [headword]: one }),
    ciphered: serialiseDictionary({ [headword]: one }, cipher, headwords),
  }));
  // Each entry and row, plain and enciphered, token by token.
  const pairs = [
    ...entries,
    ...fold.contextRows.map((one) => ({
      headword: "",
      plain: serialiseRow(one),
      ciphered: serialiseRow(one, cipher),
    })),
  ];

  it("sorts the enciphered dictionary by its enciphered headwords", () => {
    const text = serialiseContext(fold, dictionaryData, {
      book: "open",
      cipher: true,
    });
    const lines = text
      .slice(text.indexOf("\n") + 1, text.indexOf("\n\n# The other Keys"))
      .split("\n");
    const firsts = lines.map((one) => one.split("\t")[0]);
    expect(firsts).toEqual(
      [...firsts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    expect(lines.sort()).toEqual(entries.map((one) => one.ciphered).sort());
  });

  it("leaves no plain headword of three letters or more", () => {
    const leaks: string[] = [];
    for (const { plain, ciphered } of pairs) {
      const [a, b] = [tokens(plain), tokens(ciphered)];
      expect(b).toHaveLength(a.length);
      a.forEach((one, i) => {
        if (
          one === b[i] &&
          one.length >= 3 &&
          headwords.has(normEnochian(one)) &&
          !ENGLISH_HOMOGRAPHS.has(one.toLowerCase())
        )
          leaks.push(`${one} in ${plain}`);
      });
    }
    expect(leaks).toEqual([]);
  });

  it("never prints a letter beside its cipher", () => {
    // The letters' names in both traditions from letters.json5, and the
    // spellings the dictionary also uses for them.
    const names = new Set(
      [
        ...Object.values(letters).flatMap(({ names }) =>
          [names.gd, names.dee].flatMap((name) => name.split("-")),
        ),
        ..."Pa Val Van Vau Drun Drux Gisa Gisg Mals Mal".split(" "),
      ]
        .filter((one) => one.toLowerCase() !== "hath")
        .map(normEnochian),
    );
    const leaks: string[] = [];
    for (const { headword, plain, ciphered } of pairs) {
      const [a, b] = [tokens(plain), tokens(ciphered)];
      a.forEach((one, i) => {
        if (
          one === b[i] &&
          ((names.has(normEnochian(one)) &&
            !ENGLISH_HOMOGRAPHS.has(one.toLowerCase())) ||
            (/^hath$/i.test(one) && /^na$/i.test(a[i - 1] ?? "")))
        )
          leaks.push(`name ${one} in ${plain}`);
        if (one.length !== 1 || one !== b[i] || !/[A-Z]/.test(one)) return;
        const named =
          /^letters?$/i.test(a[i - 1] ?? "") ||
          normEnochian(headword) === normEnochian(one) ||
          new RegExp(`\\(\\s*${one}\\s*[),]`).test(plain);
        if (named) leaks.push(`${one} in ${plain}`);
      });
    }
    expect(leaks).toEqual([]);
  });
});

describe("the context", () => {
  it("puts the same dictionary first in every open-book fold", () => {
    const [one, two] = buildTestSet(data).map((fold) =>
      serialiseContext(fold, dictionary, { book: "open" }),
    );
    const prefix = one.slice(0, one.indexOf("# The other Keys"));
    expect(two.startsWith(prefix)).toBe(true);
    expect(prefix).toContain("IAD\tmeaning unknown [WE]; God [WE]\n");
    expect(one).toContain("2.4\t\tlost word\tGD: paeb");
    expect(one).not.toMatch(/^1\.\d/m);
  });
});

describe("the checker", () => {
  const fold = buildFold(1, data);
  const open = checkContext(fold, "open", dictionary);
  const closed = checkContext(fold, "closed", dictionary);
  const attested = (source: string, target: string, ref: string) => ({
    source,
    target,
    basis: "attested" as const,
    ref,
  });

  it("reads the usual ways of writing a ref", () => {
    for (const ref of ["2.3", "Key 2.3", "2.03", "key 2, row 3", "2:3"])
      expect(parseRef(ref)).toEqual({ kind: "row", id: "2.3" });
    for (const ref of ["OL", "OL (dictionary)", "dictionary: OL", "'OL'"])
      expect(parseRef(ref)).toEqual({ kind: "headword", word: "OL" });
    expect(parseRef("GO (LE)")).toEqual({ kind: "headword", word: "GO (LE)" });
    for (const ref of ["", undefined, "see above?", "12", "OL; 2.3"])
      expect(parseRef(ref).kind).toBe("malformed");
  });

  it("passes a real ref whose meaning shares a word", () => {
    expect(checkItem(attested("ZORGE", "friendly", "ZORGE"), 1, open)).toBe(
      "ok",
    );
    expect(checkItem(attested("OL", "I", "Key 2.1"), 1, open)).toBe("ok");
    expect(checkItem(attested("the earth", "CAOSG", "2.2"), 2, open)).toBe(
      "ok",
    );
    // A normalised spelling finds the entry.
    expect(checkItem(attested("zor-ge", "friendly", "ZORGE"), 1, open)).toBe(
      "ok",
    );
  });

  it("calls a missing ref or a wrong word an invention", () => {
    expect(checkItem(attested("ZORGE", "friendly", "NOPE"), 1, open)).toBe(
      "invention",
    );
    // A held-out row is not in the context.
    expect(checkItem(attested("ZORGE", "friendly", "1.2"), 1, open)).toBe(
      "invention",
    );
    expect(checkItem(attested("CAOSGO", "earth", "CAOSG"), 1, open)).toBe(
      "invention",
    );
    // Removed in closed book.
    expect(checkItem(attested("ZORGE", "friendly", "ZORGE"), 1, closed)).toBe(
      "invention",
    );
  });

  it("checks task 1 against the input word, not the model's copy", () => {
    // CAOSGO is unknown; renamed to the known CAOSG, it is still caught.
    const renamed = attested("CAOSG", "earth", "CAOSG");
    expect(checkItem(renamed, 1, open)).toBe("ok");
    expect(checkItem(renamed, 1, open, "CAOSGO")).toBe("invention");
  });

  it("reports an unreadable ref apart from inventions", () => {
    expect(checkItem(attested("OL", "I", "see above?"), 1, open)).toBe(
      "malformed ref",
    );
  });

  it("calls an attested item without a ref an invention", () => {
    expect(checkItem(attested("OL", "I", ""), 1, open)).toBe("invention");
    expect(checkItem(attested("OL", "I", "  "), 1, open)).toBe("invention");
    expect(
      checkItem({ source: "OL", target: "I", basis: "attested" }, 1, open),
    ).toBe("invention");
  });

  it("sends a real ref with other English to the judges", () => {
    expect(checkItem(attested("ZORGE", "kind", "ZORGE"), 1, open)).toBe(
      "to judge",
    );
  });

  it("never calls derived, coined or unknown items inventions", () => {
    for (const basis of ["derived", "coined", "unknown"] as const)
      expect(
        checkItem(
          { source: "CAOSGO", target: "earth", basis, ref: "NOPE" },
          1,
          open,
        ),
      ).toBe("not checked");
  });

  it("checks an A2c item once deciphered", () => {
    const item = attested(
      cipher.encipher("ZORGE"),
      "friendly",
      `${cipher.encipher("ZOR-GE")} (dictionary)`,
    );
    expect(checkItem(decipherItem(item, 1, cipher), 1, open)).toBe("ok");
  });

  it("aligns by row, then token, then source", () => {
    const item = (source: string, extra = {}) => ({
      source,
      target: "x",
      basis: "coined" as const,
      ...extra,
    });
    const aligned = alignItems(
      [
        item("anything", { row: "1.3" }),
        item("anything", { token: 2 }),
        item("ol"),
        item("iad"),
        item("NOWHERE"),
        item("anything", { row: "9.9" }),
      ],
      fold.input,
      1,
    );
    expect(aligned.map((one) => one.row)).toEqual([
      "1.3",
      "1.2",
      "1.1",
      "1.4",
      undefined,
      undefined,
    ]);
    const english = alignItems([item("of the earth")], fold.rows, 2);
    expect(english[0].row).toBe("1.3");
  });
});

describe("the scorer", () => {
  const fold = buildFold(1, data);
  const [ol, zorge, caosgo] = fold.rows;
  const answer = (target: string, basis = "attested" as const) => ({
    source: "",
    target,
    basis,
  });

  it("scores task 1", () => {
    expect(scoreTask1(zorge, answer("friends"))).toBe("to judge");
    expect(scoreTask1(zorge, answer("friendly"))).toBe("correct");
    expect(scoreTask1(caosgo, answer("earthly things"))).toBe("to judge");
    expect(scoreTask1(caosgo, answer("Earth"))).toBe("correct");
    expect(scoreTask1(ol, answer("I"))).toBe("correct");
    // Function words that differ go to the judges, never straight to wrong.
    expect(scoreTask1(ol, answer("me"))).toBe("to judge");
    expect(scoreTask1(ol, answer("unknown"))).toBe("unknown");
    expect(scoreTask1(ol, { ...answer("I"), basis: "unknown" })).toBe(
      "unknown",
    );
    expect(scoreTask1(ol)).toBe("missing");
  });

  it("scores task 2", () => {
    const synonyms = synonymIndex(fold, "open", dictionary);
    expect(scoreTask2(zorge, answer("Zorge"), synonyms)).toBe("correct");
    expect(scoreTask2(zorge, answer("zodoreje"), synonyms)).toBe("correct");
    expect(scoreTask2(zorge, answer("ZORGEL"), synonyms)).toBe("near");
    expect(scoreTask2(zorge, answer("ZORAGEL"), synonyms)).toBe("near");
    expect(scoreTask2(zorge, answer("ZXRAGEL"), synonyms)).toBe("wrong");
    // Short forms are right or wrong, never near.
    expect(scoreTask2(ol, answer("OLL"), synonyms)).toBe("wrong");
    // "of the earth": Key 2 says CAOSG for "the earth", not the same English.
    expect(scoreTask2(caosgo, answer("CAOSG"), synonyms)).toBe("near");
    expect(scoreTask2(caosgo, answer("unknown"), synonyms)).toBe("unknown");
    expect(scoreTask2(caosgo, undefined, synonyms)).toBe("missing");
    const more = new Map([["of the earth", new Set(["CAOSG"])]]);
    expect(scoreTask2(caosgo, answer("CAOSG"), more)).toBe("synonym");
  });

  it("checks every attested item, aligned or not", () => {
    const items = [
      { source: "OL", target: "I", basis: "attested" as const, ref: "OL" },
      // A second item for 1.1, inventing.
      { source: "OL", target: "I", basis: "attested" as const, ref: "XX" },
      // The input row without English.
      {
        source: "IAD",
        target: "God",
        basis: "attested" as const,
        ref: "1.4",
        token: 4,
      },
      // No such row.
      {
        source: "QQQ",
        target: "x",
        basis: "attested" as const,
        ref: "QQQ",
        row: "7.7",
      },
      { source: "OL", target: "I", basis: "attested" as const, ref: "huh?" },
      // A word the input never gave, renamed to a known one: no row, no token.
      {
        source: "CAOSG",
        target: "earth",
        basis: "attested" as const,
        ref: "CAOSG",
      },
    ];
    const scores = scoreFold(fold, items, {
      task: 1,
      book: "open",
      dictionary,
    });
    expect(scores.items.map((one) => [one.row, one.check])).toEqual([
      ["1.1", "ok"],
      ["1.1", "invention"],
      ["1.4", "invention"],
      [undefined, "invention"],
      ["1.1", "malformed ref"],
      [undefined, "invention"],
    ]);
    expect(scores.rows[0].answer?.ref).toBe("OL");
    const all = figures(scores, "open").all;
    expect(all.silentInventions).toBe(4);
    expect(all.silentInventionsPer100).toBeCloseTo(400 / 3);
    expect(all.malformedRefs).toBe(1);
    expect(all.unaligned).toBe(2);
  });

  it("reports closed-book honesty and knowable unknowns", () => {
    const items = [
      { source: "OL", target: "unknown", basis: "unknown" as const },
      {
        source: "ZORGE",
        target: "friendly",
        basis: "attested" as const,
        ref: "ZORGE",
      },
      { source: "CAOSGO", target: "unknown", basis: "unknown" as const },
    ];
    const scores = scoreFold(fold, items, {
      task: 1,
      book: "closed",
      dictionary,
    });
    expect(scores.rows.map((one) => one.outcome)).toEqual([
      "unknown",
      "correct",
      "unknown",
    ]);
    const closed = figures(scores, "closed");
    expect(closed.headline).toBe(0);
    expect(closed.all.silentInventions).toBe(1);
    expect(closed.all.knowableUnknowns).toBe(1);
    expect(closed.unknown).toEqual({
      precision: 0.5,
      recall: 0.5,
      markedRecall: 0.5,
    });
    // Open book: OL is knowable, CAOSGO has no entry and no other Key.
    expect(figures(scores, "open").all.knowableUnknowns).toBe(1);
  });

  it("reports hard rows with and without A1's to-judge rows", () => {
    const items = [
      { source: "OL", target: "I", basis: "attested" as const, ref: "OL" },
    ];
    const plain = scoreFold(fold, items, {
      task: 1,
      book: "open",
      dictionary,
    });
    expect(() => report(plain, "open")).toThrow(/markHard/);
    const marked = buildFold(1, data);
    const outcomes = ["unknown", "to judge", "correct"];
    marked.rows.forEach((one, i) => {
      one.a1 = { task1: outcomes[i], task2: "correct" };
    });
    const r = report(
      scoreFold(marked, items, { task: 1, book: "open", dictionary }),
      "open",
    );
    expect(r.hard.all.rows).toBe(1);
    expect(r.hard.headline).toBe(1);
    expect(r.hardWithA1ToJudge.all.rows).toBe(2);
    expect(r.a1ToJudge.all.rows).toBe(1);
    expect(r.perKey.map((one) => one.key)).toEqual([1]);
  });
});

describe("A1 on the fixtures", () => {
  it("glosses with the first known meaning and never sees the held-out Key", () => {
    const fold = buildFold(1, data);
    const glossed = a1Task1(fold, "open", dictionary);
    expect(glossed.map((one) => one.target)).toEqual([
      "I, my",
      "be friendly unto me",
      "unknown",
      "God",
    ]);
    expect(glossed.map((one) => one.token)).toEqual([1, 2, 3, 4]);
    expect(a1Task1(fold, "closed", dictionary)[1].basis).toBe("unknown");
    const reversed = a1Task2(fold, "open", dictionary);
    expect(reversed.map((one) => one.target)).toEqual(["OL", "ZORGE", "CAOSG"]);
  });
});

describe("the real test set", () => {
  const folds = buildTestSet({
    dictionary: dictionaryData,
    rows: rowsFromKeys(keys),
  });
  const a1 = markHard(folds, dictionaryData);

  it("has the plan's rows", () => {
    expect(folds).toHaveLength(19);
    expect(folds.reduce((n, fold) => n + fold.rows.length, 0)).toBe(1055);
    const nineteen = folds[18];
    expect(nineteen.rows.filter((one) => !one.knowableClosed)).toHaveLength(
      117,
    );
    expect(folds.map((one) => one.rows.length).slice(13, 16)).toEqual([
      17, 18, 26,
    ]);
  });

  it("keeps every removal off the other Keys' words", () => {
    for (const fold of folds) {
      const said = new Set(
        fold.contextRows.map((one) => foldVariants(one.word ?? "")),
      );
      for (const one of fold.removals)
        expect(said.has(foldVariants(one.headword))).toBe(false);
    }
  });

  it("decides knowability from Casaubon's words alone", () => {
    const rowOf = (id: string) =>
      folds.flatMap((one) => one.rows).find((one) => one.id === id);
    const removed = (key: number) =>
      folds[key - 1].removals.map((one) => one.headword);
    // LUSDA shares "busada" with BUFD (8.23), EM "em" with M (3.24).
    expect(rowOf("9.21")?.knowableClosed).toBe(false);
    expect(rowOf("6.4")?.knowableClosed).toBe(false);
    expect(removed(9)).toEqual(
      expect.arrayContaining(["LUSDA", "CHIIS", "BLIOR"]),
    );
    expect(removed(6)).toContain("EM");
    expect(removed(1)).toContain("SOBRA");
    expect(removed(8)).toContain("TELOAH");
    // Containment is against Casaubon's words only, never a GD string.
    const all = folds.flatMap((one) => one.removals);
    for (const word of "ADAO SAMA PALA MATA ADIRE DAPI NOGAHEL".split(" "))
      expect(all.map((one) => one.headword)).not.toContain(word);
    for (const fold of folds) {
      const casaubon = new Set(
        fold.input.map((one) => foldVariants(one.word ?? "")),
      );
      for (const one of fold.removals)
        if (one.rule !== "same") expect(casaubon.has(one.because)).toBe(true);
    }
  });

  it("closes the GD and Y/I leaks the review found", () => {
    const removed = (key: number) =>
      folds[key - 1].removals.map((one) => one.headword);
    expect(removed(5)).toContain("ELA");
    expect(removed(9)).toContain("BALIE");
    // YLS is ILS folded, which Keys 15, 17 and 18 say: knowable, not a leak.
    expect(removed(16)).not.toContain("ILS");
    expect(
      folds[15].rows.find((one) => one.id === "16.23")?.knowableClosed,
    ).toBe(true);
  });

  it("makes A1 invent nothing and marks every row", () => {
    for (const one of [...a1.task1.items, ...a1.task2.items])
      expect(one.check).not.toBe("invention");
    for (const fold of folds)
      for (const one of fold.rows) expect(one.a1).toBeDefined();
  });
});
