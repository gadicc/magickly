import { readFileSync } from "node:fs";
import dictionaryData from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { describe, expect, it } from "vitest";
import { a1kNewText, a1NewText } from "./baseline.ts";
import { serialiseDictionary } from "./context.ts";
import { dictionary as fixtureDictionary, row } from "./fixtures.ts";
import {
  newFigures,
  newReport,
  newTextContext,
  scoreNewText,
  wilson,
} from "./newscore.ts";
import {
  aethyrSlots,
  buildNewText,
  englishShape,
  englishStems,
  formsByEnglish,
  formsOf,
  joinContext,
  joinForm,
  joinRule,
  type NewTextRow,
  type NewTextSet,
  newTextRows,
  plantableShape,
  plantContext,
  plantRule,
  prng,
  SMALL_WORDS,
  shuffle,
  splitCount,
  splitParts,
  swapFits,
  swappableShape,
  swapSource,
  withNoun,
  withPlantedKnowns,
  wordInfo,
} from "./newtext.ts";
import {
  englishWords,
  FUNCTION_WORDS,
  isFunctionOnly,
  normEnochian,
  stemEnglish,
} from "./normalise.ts";
import { type KeyRowRecord, rowsFromKeys } from "./testset.ts";

const SET_PATH = new URL("./data/newtext.json", import.meta.url);
const set: NewTextSet = JSON.parse(readFileSync(SET_PATH, "utf8"));
const rows = newTextRows(set);
const keyRows = rowsFromKeys(keys);
const data = {
  dictionary: dictionaryData,
  rows: keyRows,
  exclude: aethyrSlots(keys),
};
const byId = new Map(keyRows.map((one) => [one.id, one]));
const keyRow = (id: string | undefined) => byId.get(id ?? "") as KeyRowRecord;
const ofKind = (kind: NewTextRow["kind"]) =>
  rows.filter((one) => one.kind === kind);
const sentenceNumber = (one: NewTextRow) => Number(one.sentence.slice(1));

describe("the generator's parts", () => {
  it("is deterministic from its seed", () => {
    const a = prng(7);
    const b = prng(7);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(shuffle([1, 2, 3, 4, 5], prng(1))).toEqual(
      shuffle([1, 2, 3, 4, 5], prng(1)),
    );
  });

  it("gives Dee's English a shape", () => {
    expect(englishShape("the horns")).toBe(englishShape("the seats"));
    expect(englishShape("the horns")).toBe("the N");
    expect(englishShape("reigneth")).toBe("V");
    expect(englishShape("beautified")).not.toBe(englishShape("seats"));
    expect(swappableShape("and")).toBe(false);
    expect(swappableShape("moreover")).toBe(false);
    expect(swappableShape("the rest")).toBe(false);
    expect(plantableShape("of the earth,")).toBe(true);
    expect(plantableShape("the holy ones")).toBe(false);
  });

  it("puts a noun in a row's English, its article agreeing", () => {
    expect(withNoun("the horns", "kettle")).toBe("the kettle");
    expect(withNoun("The Sun", "kettle")).toBe("The Kettle");
    expect(withNoun("a Sword", "anvil")).toBe("an Anvil");
    expect(withNoun("of an Oak,", "kettle")).toBe("of a Kettle,");
  });

  it("counts splits, a shared letter written once (G27)", () => {
    const parts = splitParts(new Set(["DS", "SONF", "ONF", "ZORGE", "OL"]));
    expect(splitCount("DSONF", parts)).toBe(2); // DS+ONF, DS+SONF
    expect(splitCount("ZORGE", parts)).toBe(1);
    expect(splitCount("IZORGE", parts)).toBe(1); // I is a G26 small word
    expect(splitCount("XYZ", parts)).toBe(0);
    expect(joinForm("DS", "SONF")).toBe("DSONF");
    expect(joinForm("TA", "OL")).toBe("TAOL");
  });

  it("applies the planted words' rule in order", () => {
    const context = plantContext({
      dictionary: fixtureDictionary,
      rows: [row(1, 1, "ZORGE", "be friendly"), row(1, 2, "TALO", "the sun")],
    });
    expect(plantRule("ZORGA", context)).toBe("near");
    expect(plantRule("BIPZORGEX", context)).toBe("contains");
    expect(plantRule("OLTALOL", context)).toBe("contains");
    expect(plantRule("IADOL", context)).toBe("near");
    expect(plantRule("QUIPLUX", context)).toBeUndefined();
    // Far from every form, but not once C/K and U/V/W are one.
    expect(plantRule("KEWEB", { ...context, folded: new Set(["CEVEB"]) })).toBe(
      "folded",
    );
    expect(plantRule("QUIPLUX", context, ["QUIPLAX"])).toBe("taken");
    expect(plantRule("SUN", { ...context, forms: new Set() })).toBe("english");
  });

  it("applies the joins' rules", () => {
    const context = joinContext({
      dictionary: {},
      rows: [
        row(1, 1, "DS", "which"),
        row(1, 2, "SONF", "reign"),
        row(2, 1, "BALT", "justice"),
        row(2, 2, "MOOOAH", "it repenteth me"),
        row(3, 1, "TABALT", "as justice"),
        row(3, 2, "QQQ", "that Justice"),
      ],
    });
    expect(joinRule("DS", "SONF", "reign", context)).toBe("adjacent");
    expect(joinRule("TA", "BALT", undefined, context)).toBe("attested");
    expect(joinRule("OI", "BALT", "justice", context)).toBeUndefined();
    expect(joinRule("AR", "BALT", "justice", context)).toBe("english");
    expect(joinRule("AR", "MOOOAH", "that it repenteth", context)).toBe(
      "sense",
    );
  });

  it("puts the planted knowns among the entries, in order", () => {
    const sorted = Object.fromEntries(
      Object.entries(fixtureDictionary).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    const shown = withPlantedKnowns(sorted, [
      { headword: "CAOSGA", meaning: "kettle", source: "WE" },
      { headword: "AAA", meaning: "spoon", source: "WE" },
    ]);
    const words = Object.keys(shown);
    expect(words[0]).toBe("AAA");
    expect(words.indexOf("CAOSGA")).toBe(words.indexOf("CAOSG") + 1);
    expect(serialiseDictionary(shown)).toContain("CAOSGA\tkettle [WE]");
  });
});

describe("the new text", () => {
  it("is what the seed makes", { timeout: 60_000 }, () => {
    const again = buildNewText(data, { seed: set.seed });
    expect({ ...again, meta: { ...again.meta, leitch: null } }).toEqual({
      ...set,
      meta: { ...set.meta, leitch: null },
    });
  });

  it("has the plan's rows and sentences", () => {
    expect(set.sentences).toHaveLength(60);
    expect(rows).toHaveLength(600);
    expect(ofKind("unchanged")).toHaveLength(380);
    expect(ofKind("swapped")).toHaveLength(120);
    expect(ofKind("plant")).toHaveLength(40);
    expect(ofKind("known")).toHaveLength(20);
    expect(ofKind("join")).toHaveLength(40);
    expect(rows.filter((one) => one.gdSpelling)).toHaveLength(50);
    for (const sentence of set.sentences)
      sentence.rows.forEach((one, i) => {
        expect(one.sentence).toBe(sentence.id);
        expect(one.id).toBe(`${sentence.id}.${String(i + 1).padStart(2, "0")}`);
      });
  });

  it("joins passages of two Keys, every Key giving one", () => {
    const used = new Set<number>();
    for (const sentence of set.sentences) {
      const keysOf = sentence.passages.map((one) => Number(one.split(".")[0]));
      expect(keysOf[0]).not.toBe(keysOf[1]);
      for (const key of keysOf) used.add(key);
      // Each passage: 3–8 consecutive rows of one Key.
      for (const passage of sentence.passages) {
        const [from, to] = passage.split("–").map((one) => keyRow(one));
        expect(from.key).toBe(to.key);
        expect(to.row - from.row + 1).toBeGreaterThanOrEqual(3);
        expect(to.row - from.row + 1).toBeLessThanOrEqual(8);
      }
    }
    expect(used.size).toBe(19);
  });

  it("uses no row twice and never Key 19's Aethyr name", () => {
    const at = rows.map((one) => one.at);
    const sources = ofKind("swapped").map((one) => one.source as string);
    expect(new Set([...at, ...sources]).size).toBe(at.length + sources.length);
    for (const id of [...at, ...sources])
      expect(data.exclude.has(id)).toBe(false);
    expect(data.exclude.size).toBe(1);
  });

  it("swaps only by the swap rules", () => {
    const info = wordInfo(data);
    const byEnglish = formsByEnglish(keyRows);
    const words = ofKind("swapped").map((one) =>
      normEnochian(keyRow(one.source).word ?? ""),
    );
    expect(new Set(words).size).toBe(words.length);
    for (const one of ofKind("swapped")) {
      const replaced = keyRow(one.at);
      const source = keyRow(one.source);
      expect(swapSource(source, info, byEnglish)).toBeUndefined();
      expect(swapFits(replaced, source, info)).toBe(true);
      expect(englishShape(replaced.english)).toBe(englishShape(source.english));
      expect(isFunctionOnly(replaced.english)).toBe(false);
      expect(one.english).toBe(source.english);
      expect(one.replaced?.english).toBe(replaced.english);
      expect(one.multi ?? false).toBe(
        (info.get(normEnochian(source.word ?? ""))?.rows.length ?? 0) > 1,
      );
    }
  });

  it("plants words by the strict rule, with English nothing translates", () => {
    const context = plantContext(data);
    const made = [...ofKind("plant"), ...ofKind("known")].map(
      (one) => one.enochian,
    );
    expect(new Set(made).size).toBe(60);
    made.forEach((word, i) => {
      expect(word.length).toBeGreaterThanOrEqual(4);
      expect(word.length).toBeLessThanOrEqual(8);
      expect(
        plantRule(
          word,
          context,
          made.filter((_, j) => j !== i),
        ),
      ).toBeUndefined();
    });
    const stems = englishStems(data);
    const nouns = (list: readonly NewTextRow[]) =>
      list.flatMap((one) =>
        englishWords(one.english).filter(
          (word) =>
            !FUNCTION_WORDS.has(word) &&
            !englishWords(keyRow(one.at).english).includes(word),
        ),
      );
    const plantNouns = nouns(ofKind("plant"));
    const knownNouns = set.plantedKnowns.map((one) => one.meaning);
    expect(plantNouns).toHaveLength(40);
    for (const word of [...plantNouns, ...knownNouns])
      expect(stems.has(stemEnglish(word))).toBe(false);
    const plantStems = new Set(plantNouns.map(stemEnglish));
    for (const word of knownNouns)
      expect(plantStems.has(stemEnglish(word))).toBe(false);
  });

  it("gives the planted knowns their meanings, in the first 30 sentences", () => {
    const known = new Map(
      set.plantedKnowns.map((one) => [one.headword, one.meaning]),
    );
    for (const one of ofKind("known")) {
      expect(sentenceNumber(one)).toBeLessThanOrEqual(30);
      expect(englishWords(one.english)).toContain(known.get(one.enochian));
      expect(one.forms).toEqual([one.enochian]);
    }
    const forms = formsOf(data);
    for (const one of set.plantedKnowns)
      expect(forms.has(normEnochian(one.headword))).toBe(false);
  });

  it("makes new joins that split exactly once, in the first 30 sentences", () => {
    const context = joinContext(data);
    const forms = formsOf(data);
    for (const one of ofKind("join")) {
      const join = one.join as NonNullable<NewTextRow["join"]>;
      const word = normEnochian(join.word);
      expect(sentenceNumber(one)).toBeLessThanOrEqual(30);
      expect(joinRule(join.small, word, join.english, context)).toBeUndefined();
      expect(splitCount(normEnochian(one.enochian), context.parts)).toBe(1);
      expect(forms.has(normEnochian(one.enochian))).toBe(false);
      expect(one.english).toBe(
        `${SMALL_WORDS[join.small].gloss} ${join.english}`,
      );
      expect(one.forms.map(normEnochian)).toContain(normEnochian(one.enochian));
      expect(one.forms.map(normEnochian)).toContain(join.small + word);
    }
  });

  it("shows the GD's spelling where it differs", () => {
    for (const one of rows.filter((x) => x.gdSpelling)) {
      const source = keyRow(one.source);
      expect(["unchanged", "swapped"]).toContain(one.kind);
      expect(one.enochian).toBe(source.gd?.toUpperCase());
      expect(normEnochian(one.enochian)).not.toBe(
        normEnochian(source.word ?? ""),
      );
    }
  });

  it("fixes the repeat runs' rows as whole sentences", () => {
    const ids = new Set(set.repeat.sentences);
    const count = set.sentences
      .filter((one) => ids.has(one.id))
      .reduce((n, one) => n + one.rows.length, 0);
    expect(count).toBe(set.repeat.rows);
    expect(count).toBeGreaterThanOrEqual(150);
    expect(count).toBeLessThan(170);
  });
});

// --- A1k and the scorer, on made-up rows ----------------------------------------

const kRows = [
  row(1, 1, "OL", "I"),
  row(2, 1, "OL", "I"),
  row(3, 1, "OL", "made"),
  row(1, 2, "ZORGE", "be friendly unto me", "zodoreje"),
  row(2, 2, "CAOSG", "the earth"),
  row(3, 2, "CAOSGI", "the earth"),
  row(4, 2, "CAOSG", "the earth"),
  row(2, 3, "IAD", "God"),
];
const shown = withPlantedKnowns(fixtureDictionary, [
  { headword: "QXBRAL", meaning: "kettle", source: "WE" },
]);
const context = newTextContext(shown, kRows);

function newRow(
  id: string,
  kind: NewTextRow["kind"],
  enochian: string,
  english: string,
  extra: Partial<NewTextRow> = {},
): NewTextRow {
  return {
    id,
    sentence: id.slice(0, 3),
    kind,
    at: "9.9",
    enochian,
    english,
    forms: kind === "plant" ? [] : [enochian],
    ...extra,
  };
}

const testRows: NewTextRow[] = [
  newRow("S01.01", "unchanged", "ZORGE", "be friendly unto me", {
    forms: ["ZORGE", "zodoreje"],
  }),
  newRow("S01.02", "swapped", "CAOSG", "the earth", {
    glosses: ["the earth"],
    replaced: { word: "IAD", english: "God", glosses: ["God", "the Lord"] },
  }),
  newRow("S01.03", "plant", "TUBLOX", "the bicycle"),
  newRow("S01.04", "known", "QXBRAL", "the kettle"),
  newRow("S01.05", "join", "DSIAD", "which God", {
    forms: ["DSIAD"],
    join: {
      small: "DS",
      word: "IAD",
      senses: ["which", "that"],
      english: "God",
    },
  }),
];

describe("A1k on the new text", () => {
  const inputs = [
    { id: "a", enochian: "OL", english: "the earth" },
    { id: "b", enochian: "ZODOREJE", english: "God" },
    { id: "c", enochian: "ORG", english: "kettle" },
    { id: "d", enochian: "TUBLOX", english: "the bicycle" },
    { id: "e", enochian: "QXBRAL", english: "be friendly unto me" },
  ];

  it("takes the Keys' commonest gloss, else A1's, else unknown", () => {
    const { task1 } = a1kNewText(inputs, shown, kRows);
    expect(task1.map((one) => [one.target, one.ref])).toEqual([
      ["I", "1.1"], // two rows of three
      ["be friendly unto me", "1.2"], // by its GD form
      ["a short word", "ORG"], // in no Key: A1's first known meaning
      ["unknown", undefined],
      ["kettle", "QXBRAL"], // a planted known, from the prompt's dictionary
    ]);
  });

  it("takes the Keys' commonest form for the English, else A1's index", () => {
    const { task2 } = a1kNewText(inputs, shown, kRows);
    expect(task2.map((one) => [one.target, one.ref])).toEqual([
      ["CAOSG", "2.2"], // two rows of three
      ["IAD", "2.3"],
      ["QXBRAL", "QXBRAL"], // A1's reverse index finds the planted known
      ["unknown", undefined],
      ["ZORGE", "1.2"],
    ]);
  });

  it("leaves A1 to the dictionary alone", () => {
    const { task1, task2 } = a1NewText(inputs, shown, kRows);
    expect(task1[0].target).toBe("I, my");
    expect(task1[1].basis).toBe("unknown"); // GD forms aren't headwords
    expect(task2[0].target).toBe("CAOSG");
  });
});

describe("scoring the new text", () => {
  const item = (
    row: string,
    source: string,
    target: string,
    basis: "attested" | "derived" | "coined" | "unknown",
    ref?: string,
  ) => ({ row, source, target, basis, ...(ref ? { ref } : {}) });

  it("scores each row kind in task 1", () => {
    const scores = scoreNewText(
      testRows,
      [
        item("S01.01", "ZORGE", "be friendly", "attested", "1.2"),
        item("S01.02", "CAOSG", "God", "derived"),
        item("S01.03", "TUBLOX", "unknown", "unknown"),
        item("S01.04", "QXBRAL", "a kettle", "attested", "QXBRAL"),
        item("S01.05", "DSIAD", "which God", "derived", "IAD"),
      ],
      1,
      context,
    );
    expect(scores.rows.map((one) => one.outcome)).toEqual([
      "correct",
      "recalled",
      "unknown",
      "correct",
      "correct",
    ]);
    expect(scores.rows[1].hedged).toBe(true);
    expect(scores.items.map((one) => one.check)).toEqual([
      "ok",
      "not checked",
      "not checked",
      "ok",
      "not checked",
    ]);
  });

  it("calls a join right only when both parts are rendered", () => {
    const one = (target: string) =>
      scoreNewText(
        testRows,
        [item("S01.05", "DSIAD", target, "derived", "IAD")],
        1,
        context,
      ).rows[4].outcome;
    expect(one("which God")).toBe("correct");
    expect(one("that God")).toBe("correct");
    expect(one("God")).toBe("to judge");
    expect(one("which")).toBe("to judge");
  });

  it("takes a join joined or apart in task 2", () => {
    const score = (items: ReturnType<typeof item>[]) =>
      scoreNewText(testRows, items, 2, context).rows[4].outcome;
    expect(score([item("S01.05", "which God", "DSIAD", "derived")])).toBe(
      "correct",
    );
    expect(score([item("S01.05", "which God", "DS IAD", "derived")])).toBe(
      "correct",
    );
    expect(
      score([
        item("S01.05", "which", "DS", "attested", "DS"),
        item("S01.05", "God", "IAD", "attested", "IAD"),
      ]),
    ).toBe("correct");
    expect(score([item("S01.05", "which God", "IAD", "derived")])).toBe("near");
  });

  it("gives a plant its outcome, and an attested one is a silent invention", () => {
    const plant = (
      target: string,
      basis: Parameters<typeof item>[3],
      ref?: string,
      task: 1 | 2 = 1,
    ) => {
      const scores = scoreNewText(
        testRows,
        [
          item(
            "S01.03",
            task === 1 ? "TUBLOX" : "the bicycle",
            target,
            basis,
            ref,
          ),
        ],
        task,
        context,
      );
      return {
        outcome: scores.rows[2].outcome,
        silent: newFigures(scores).silentInventions,
        fails: newFigures(scores).plantFailures.count,
      };
    };
    expect(plant("unknown", "unknown")).toEqual({
      outcome: "unknown",
      silent: 0,
      fails: 0,
    });
    expect(plant("a bicycle", "coined")).toEqual({
      outcome: "coined",
      silent: 0,
      fails: 0,
    });
    // TUBLOX holds no form; a ref inside the word supports the derivation.
    expect(plant("a bicycle", "derived", "IAD").outcome).toBe(
      "unsupported guess",
    );
    expect(plant("a bicycle", "derived", "IAD").fails).toBe(1);
    expect(plant("a bicycle", "attested", "TUBLOX")).toEqual({
      outcome: "attested",
      silent: 1,
      fails: 1,
    });
    // Task 2: the answer's Enochian is the word a derivation must be inside.
    expect(plant("IADOL", "derived", "IAD", 2).outcome).toBe("derived");
    expect(plant("IADOL", "derived", "2.3", 2).outcome).toBe("derived");
    expect(plant("IADOL", "derived", "ZORGE", 2).outcome).toBe(
      "unsupported guess",
    );
    // Even a real ref that checks out: a plant given as attested is invented.
    expect(plant("IAD", "attested", "IAD", 2)).toEqual({
      outcome: "attested",
      silent: 1,
      fails: 1,
    });
  });

  it("scores planted knowns and task 2's forms", () => {
    const scores = scoreNewText(
      testRows,
      [
        item("S01.01", "be friendly unto me", "zodoreje", "attested", "1.2"),
        item("S01.02", "the earth", "CAOSGI", "attested", "3.2"),
        item("S01.04", "the kettle", "QXBRAL", "attested", "QXBRAL"),
      ],
      2,
      context,
    );
    expect(scores.rows.map((one) => one.outcome)).toEqual([
      "correct",
      "synonym",
      "missing",
      "correct",
      "missing",
    ]);
  });

  it("reports figures per row kind", () => {
    const scores = scoreNewText(
      testRows,
      [
        item("S01.01", "ZORGE", "unknown", "unknown"),
        item("S01.02", "CAOSG", "the earth", "attested", "2.2"),
        item("S01.04", "QXBRAL", "kettle", "attested", "QXBRAL"),
        item("S01.05", "DSIAD", "which God", "derived", "IAD"),
        item("S01.03", "TUBLOX", "unknown", "unknown"),
      ],
      1,
      context,
    );
    const report = newReport(scores);
    expect(report.all.right.count).toBe(4);
    expect(report.unchanged.right.count).toBe(0);
    expect(report.unchanged.hedged).toBe(1);
    expect(report.unchanged.knowableUnknowns).toBe(1);
    expect(report.swapped.right.count).toBe(1);
    expect(report.swapped.recalled).toMatchObject({ count: 0, rows: 1 });
    expect(report.plant.right.count).toBe(1);
    expect(report.join.right.count).toBe(1);
    expect(report.known.right.count).toBe(1);
    expect(report.all.marked).toBe(1);
  });
});

describe("intervals", () => {
  it("gives Wilson's 95% interval", () => {
    const [a, b] = wilson(5, 10);
    expect(a).toBeCloseTo(0.2366, 4);
    expect(b).toBeCloseTo(0.7634, 4);
    expect(wilson(0, 10)[0]).toBe(0);
    expect(wilson(0, 10)[1]).toBeCloseTo(0.2775, 4);
    expect(wilson(10, 10)[0]).toBeCloseTo(0.7225, 4);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});
