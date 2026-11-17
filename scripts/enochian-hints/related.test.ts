import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dictionary from "magick-data/enochian/dictionary";
import { afterAll, describe, expect, it } from "vitest";
import {
  RELATED_TABLE_FORMAT,
  type RelatedItem,
  type RelatedTable,
  relatedIndex,
  relatedTableText,
} from "../../src/app/enochian/dictionary/related/format.ts";
import { buildKeysTable } from "../../src/app/enochian/translate/keysTable.ts";
import { createTranslator } from "../../src/app/enochian/translate/lookup.ts";
import { fold } from "../../src/app/enochian/translate/lookupData.ts";
import { HUB_FORMS, hintGlosses } from "./glosses.ts";
import { HINT_RECIPE } from "./recipe.ts";
import {
  type Candidate,
  differentNumbers,
  entryGlosses,
  fitRelated,
  glossLinks,
  glossMembers,
  type Link,
  MAX_RELATED,
  numbersIn,
  RELATED_TABLE_FILE,
  rankRelated,
  relatedGlosses,
  relatedHash,
  relatedSampleFile,
  relatedSampleName,
  relatedTableAt,
  sampleRelated,
  similarityZ,
} from "./related.ts";
import {
  readVerdicts,
  SAMPLE_SIZE,
  score,
  servedBytes,
  writeNewSample,
} from "./table.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scratch = mkdtempSync(path.join(tmpdir(), "enochian-related-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const HEAD = { recipe: HINT_RECIPE.id, asked: 1, glossHash: "0" };

/** Unit vectors from rough directions. */
function unit(rows: readonly (readonly number[])[]): Float32Array {
  const dimensions = rows[0].length;
  const out = new Float32Array(rows.length * dimensions);
  rows.forEach((row, at) => {
    const n = Math.hypot(...row);
    out.set(
      row.map((x) => x / n),
      at * dimensions,
    );
  });
  return out;
}

const link = (form: string, entry = form): Link => ({ form, entry });

/**
 * Made-up glosses: "light" and "brightness" close, "shining" close to
 * both; "sun" nearer than "fire"; "stone" far from all.
 */
const FAKE = [
  {
    text: "light",
    shown: "light",
    members: ["OLPIRT"],
    links: [link("OLPIRT")],
  },
  {
    text: "brightness",
    shown: "brightness",
    members: ["LUCIFTIAS"],
    links: [link("LUCIFTIAS")],
  },
  // Shares a form with "brightness": shown once, under the better.
  {
    text: "of brightness",
    shown: "of brightness",
    members: ["LUCIFTIAS", "LUCIFTIAN"],
    links: [link("LUCIFTIAS"), link("LUCIFTIAN")],
  },
  { text: "shining", shown: "shining", members: ["DE"], links: [] },
  { text: "sun", shown: "sun", members: ["ROR"], links: [link("ROR")] },
  { text: "fire", shown: "fire", members: ["PRGE"], links: [link("PRGE")] },
  { text: "stone", shown: "stone", members: ["ORRI"], links: [link("ORRI")] },
];
const VECTORS = unit([
  [1, 0.1, 0, 0, 0],
  [0.95, 0.2, 0, 0, 0.05],
  [0.93, 0.22, 0, 0, 0.04],
  [0.9, 0.3, 0, 0, 0],
  [0.6, 0, 0.6, 0, 0],
  [0.3, 0, 0.3, 0.6, 0],
  [0, 0, 0, 0.1, 1],
]);

describe("the relation (plan 081, S11, step 2G)", () => {
  const z = similarityZ(VECTORS, 5);
  const count = FAKE.length;

  it("z-scores each gloss's cosines against its own to all the others", () => {
    for (let g = 0; g < count; g++) {
      const row = Array.from({ length: count }, (_, h) => z[g * count + h]);
      expect(row[g]).toBeNaN();
      const others = row.filter((_, h) => h !== g);
      const mean = others.reduce((a, b) => a + b, 0) / others.length;
      const sd = Math.sqrt(
        others.reduce((a, b) => a + b * b, 0) / others.length - mean * mean,
      );
      expect(mean).toBeCloseTo(0, 6);
      expect(sd).toBeCloseTo(1, 6);
    }
    // Light's nearest is brightness, its furthest stone.
    const light = Array.from({ length: count }, (_, h) => z[h]);
    expect(light.indexOf(Math.max(...light.slice(1)))).toBe(1);
    expect(light.indexOf(Math.min(...light.slice(1)))).toBe(6);
  });

  it("gives an entry its best three, never its own gloss, a hub, a repeated form or a gloss with no entry", () => {
    const byEntry = entryGlosses(FAKE);
    // DE is a hub word: it gets nothing.
    expect(byEntry.has("DE")).toBe(false);
    expect(byEntry.get("LUCIFTIAS")).toEqual([1, 2]);
    const ranked = rankRelated(byEntry, z, FAKE);
    const of = (entry: string) =>
      ranked
        .filter((one) => one.entry === entry)
        .map((one) => [
          FAKE[one.gloss].shown,
          one.links.map((x) => x.entry).join(" "),
        ]);
    // Light: brightness, then "of brightness" with only the form not
    // yet shown; "shining" has no form that opens an entry.
    expect(of("OLPIRT")).toEqual([
      ["brightness", "LUCIFTIAS"],
      ["of brightness", "LUCIFTIAN"],
      ["sun", "ROR"],
    ]);
    for (const entry of byEntry.keys()) {
      const mine = ranked.filter((one) => one.entry === entry);
      expect(mine.length).toBeLessThanOrEqual(MAX_RELATED);
      // Best first, never its own gloss nor a form that opens it.
      expect(mine.map((one) => one.z)).toEqual(
        [...mine.map((one) => one.z)].sort((a, b) => b - a),
      );
      for (const one of mine) {
        expect(byEntry.get(entry)).not.toContain(one.gloss);
        expect(one.links.map((x) => x.entry)).not.toContain(entry);
      }
      const forms = mine.flatMap((one) => one.links.map((x) => x.entry));
      expect(new Set(forms).size).toBe(forms.length);
    }
    // LUCIFTIAS's own two glosses are both left out; its best is light.
    expect(of("LUCIFTIAS")[0]).toEqual(["light", "OLPIRT"]);
    expect(of("LUCIFTIAS").map(([shown]) => shown)).not.toContain(
      "of brightness",
    );
  });

  it("ranks by the best z from any of the entry's glosses, not the mean or the first", () => {
    // The entry's own glosses are 0 and 1. Gloss 2 stands out from 1
    // alone (z 9 from it, -1 from 0: best 9, mean 4, first -1); gloss 3
    // is fairly close to both (6 and 6).
    const glosses = ["own one", "own two", "sharp", "broad"].map((text) => ({
      text,
      links: [link(text.toUpperCase().replace(" ", ""))],
    }));
    const zOf = [
      [Number.NaN, 0, -1, 6],
      [0, Number.NaN, 9, 6],
      [0, 0, Number.NaN, 0],
      [0, 0, 0, Number.NaN],
    ];
    const ranked = rankRelated(
      new Map([["E", [0, 1]]]),
      Float64Array.from(zOf.flat()),
      glosses,
    );
    expect(ranked.map((one) => [one.gloss, one.z])).toEqual([
      [2, 9],
      [3, 6],
    ]);
  });

  it("names the numbers a gloss names", () => {
    const of = (text: string) => [...numbersIn(text)];
    expect(of("nineteen")).toEqual(["19"]);
    expect(of("twenty eight")).toEqual(["28"]);
    expect(of("twenty-eighth")).toEqual(["28"]);
    expect(of("nine")).toEqual(["9"]);
    expect(of("not the ninth")).toEqual(["9"]);
    expect(of("half")).toEqual(["1/2"]);
    expect(of("one half")).toEqual(["1/2"]);
    expect(of("one fourth")).toEqual(["1/4"]);
    expect(of("at any quarter")).toEqual(["1/4"]);
    expect(of("fourth")).toEqual(["4"]);
    expect(of("a thousand angels")).toEqual(["1000"]);
    expect(of("three hundred")).toEqual(["300"]);
    expect(of("one hundred")).toEqual(["100"]);
    expect(of("12")).toEqual(["12"]);
    expect(of("light")).toEqual([]);
    expect(differentNumbers(numbersIn("nineteen"), numbersIn("nine"))).toBe(
      true,
    );
    expect(differentNumbers(numbersIn("half"), numbersIn("two"))).toBe(true);
    expect(differentNumbers(numbersIn("fourth"), numbersIn("a quarter"))).toBe(
      true,
    );
    expect(differentNumbers(numbersIn("eight"), numbersIn("eighth"))).toBe(
      false,
    );
    expect(differentNumbers(numbersIn("nine"), numbersIn("light"))).toBe(false);
  });

  it("keeps glosses sharing a number, though “one” and “first” aren't always numbers", () => {
    const differ = (a: string, b: string) =>
      differentNumbers(numbersIn(a), numbersIn(b));
    // FALOD and DANPHA, from the build below 6.75.
    expect(differ("the third arrives first", "the third")).toBe(false);
    expect(differ("the third arrives first", "in the third")).toBe(false);
    expect(differ("the three are One", "all one")).toBe(false);
    expect(differ("the one who is seventh", "the seventh")).toBe(false);
    expect(differ("unto every one of you", "one")).toBe(false);
    expect(differ("unto every one of the twelve", "twelve")).toBe(false);
    expect(differ("at first the fourth", "fourth")).toBe(false);
    expect(differ("a second", "the second")).toBe(false);
    expect(differ("a second of the ninth", "ninth")).toBe(false);
    // Sharing none still differs.
    expect(differ("the third arrives first", "the fifth")).toBe(true);
  });

  it("drops a related word naming another number than the entry's gloss it matched", () => {
    // AF "nineteen": "nine" is nearest but another number, "nineteenth"
    // the same one, "count" names none.
    const glosses = ["nineteen", "nine", "nineteenth", "count"].map((text) => ({
      text,
      links: [link(text.toUpperCase())],
    }));
    const zOf = [
      [Number.NaN, 9, 8, 7],
      [0, Number.NaN, 0, 0],
      [0, 0, Number.NaN, 0],
      [0, 0, 0, Number.NaN],
    ];
    const dropped: Candidate[] = [];
    const ranked = rankRelated(
      new Map([["AF", [0]]]),
      Float64Array.from(zOf.flat()),
      glosses,
      MAX_RELATED,
      (one) => dropped.push(one),
    );
    expect(ranked.map((one) => glosses[one.gloss].text)).toEqual([
      "nineteenth",
      "count",
    ]);
    expect(dropped.map((one) => glosses[one.gloss].text)).toEqual(["nine"]);
  });

  it("builds the table at a cut-off, keyed by entry, without scores", () => {
    const ranked = rankRelated(entryGlosses(FAKE), z, FAKE);
    const cut = ranked.find(
      (one) => one.entry === "OLPIRT" && FAKE[one.gloss].shown === "sun",
    )?.z as number;
    const table = relatedTableAt(ranked, FAKE, cut, HEAD);
    expect(table.format).toBe(RELATED_TABLE_FORMAT);
    expect(table.cutoff).toBe(cut);
    expect(table.items).toBe(ranked.filter((one) => one.z >= cut).length);
    expect(table.entries).toBe(Object.keys(table.related).length);
    // No scores: the table holds wordings, forms and indices only.
    expect(Object.keys(table).sort()).toEqual(
      [
        "asked",
        "cutoff",
        "entries",
        "format",
        "glossHash",
        "glosses",
        "items",
        "recipe",
        "related",
      ].sort(),
    );
    for (const list of Object.values(table.related))
      for (const at of list) expect(Number.isInteger(at)).toBe(true);
    const index = relatedIndex(table);
    expect(index.get("OLPIRT")).toEqual([
      {
        gloss: "brightness",
        forms: [{ form: "LUCIFTIAS", entry: "LUCIFTIAS" }],
      },
      {
        gloss: "of brightness",
        forms: [{ form: "LUCIFTIAN", entry: "LUCIFTIAN" }],
      },
      { gloss: "sun", forms: [{ form: "ROR", entry: "ROR" }] },
    ]);
    // Each row once, by wording.
    const rows = table.glosses.map(([shown]) => shown);
    expect(rows).toEqual([...new Set(rows)].sort());
    expect(rows).toContain("of brightness");
    // Committed one row a line, and read back as it was.
    expect(JSON.parse(relatedTableText(table))).toEqual(table);
    expect(relatedTableText(table).split("\n").length).toBeGreaterThan(
      table.glosses.length + table.entries,
    );
  });

  it("writes a form under a key it isn't spelled as", () => {
    const table = relatedTableAt(
      [
        {
          entry: "A",
          gloss: 0,
          z: 9,
          links: [link("A-BAI", "A-BAI"), link("GO (LE)", "GO")],
        },
      ],
      [{ shown: "attacking" }],
      1,
      HEAD,
    );
    expect(table.glosses).toEqual([
      ["attacking", ["A-BAI", ["GO (LE)", "GO"]]],
    ]);
    expect(relatedIndex(table).get("A")?.[0].forms).toEqual([
      { form: "A-BAI", entry: "A-BAI" },
      { form: "GO (LE)", entry: "GO" },
    ]);
  });

  /** Many made-up pairs, z from 5 to 9, over three glosses. */
  const many: Candidate[] = Array.from({ length: 4000 }, (_, at) => ({
    entry: `E${at}`,
    gloss: at % 3,
    z: 5 + at / 1000,
    links: [link(`F${at % 3}`)],
  }));
  const shownOf = [{ shown: "a" }, { shown: "b" }, { shown: "c" }];

  it("keeps the asked cut-off when the table fits its budget, else raises it", () => {
    const fits = fitRelated(many, shownOf, { ...HEAD, asked: 5 }, 10_000_000);
    expect(fits.cutoff).toBe(5);
    expect(fits.items).toBe(many.length);
    const budget = servedBytes(
      relatedTableAt(many, shownOf, 7.5, { ...HEAD, asked: 5 }),
    ).gzip;
    const raised = fitRelated(many, shownOf, { ...HEAD, asked: 5 }, budget);
    expect(servedBytes(raised).gzip).toBeLessThanOrEqual(budget);
    expect(raised.cutoff).toBeGreaterThan(5);
    expect(raised.cutoff).toBeLessThanOrEqual(7.5);
    expect(String(raised.cutoff)).toMatch(/^\d+(\.\d)?$/);
  });

  it("draws the same distinct pairs for the same seed, and scores the judges' file", () => {
    const one = sampleRelated(many, 200, 1);
    expect(one).toHaveLength(200);
    expect(new Set(one.map((pair) => pair.entry)).size).toBe(200);
    expect(sampleRelated(many, 200, 1)).toEqual(one);
    expect(sampleRelated(many, 200, 2)).not.toEqual(one);
    expect(sampleRelated(many.slice(0, 50), 200, 1)).toHaveLength(50);

    const file = relatedSampleFile(
      one.slice(0, 3),
      shownOf,
      (entry) => [`meaning of ${entry}`, "another\tone"],
      5,
      1,
    );
    expect(file).toContain("(seed 1) from the table at z >= 5.");
    expect(file).toContain("n\tentry\tmeanings\trelated\tz\tverdict\n");
    const [first] = one;
    expect(file).toContain(
      `${first.entry}\tmeaning of ${first.entry} / another one\tF${first.gloss} ‘${shownOf[first.gloss].shown}’\t${first.z.toFixed(6)}\t\n`,
    );
    const filled = file
      .split("\n")
      .map((line, at, lines) =>
        /^\d/.test(line)
          ? `${line}${at === lines.length - 2 ? "wrong" : "good"}`
          : line,
      )
      .join("\n");
    const { judged, unjudged } = readVerdicts(filled);
    expect(unjudged).toBe(0);
    expect(judged.map((pair) => pair.word)).toEqual(
      one.slice(0, 3).map((pair) => pair.entry),
    );
    expect(judged[0].hint).toBe(
      `F${first.gloss} ‘${shownOf[first.gloss].shown}’`,
    );
    expect(score(judged).all).toMatchObject({ n: 3, good: 2, wrong: 1 });

    expect(relatedSampleName(1, 6)).toBe("related-sample-seed1-z6.tsv");
    const at = path.join(scratch, relatedSampleName(1, 6));
    writeNewSample(at, filled);
    expect(() => writeNewSample(at, file)).toThrow(/exists/);
    expect(readFileSync(at, "utf8")).toBe(filled);
  });
});

describe("the related words on our glosses", () => {
  const translator = createTranslator(buildKeysTable(), dictionary);
  const candidates = relatedGlosses(translator, hintGlosses(translator));
  const by = (text: string) => candidates.find((one) => one.text === text);

  it("knows the entries a gloss means, and the forms that open one", () => {
    const sunrise = by("sunrise");
    expect(sunrise && glossMembers(translator, sunrise)).toContain("RNAH");
    expect(sunrise && glossLinks(translator, sunrise)).toEqual([
      { form: "RNAH", entry: "RNAH" },
    ]);
    for (const one of candidates) {
      for (const { entry } of one.links) {
        expect(Object.hasOwn(dictionary, entry), entry).toBe(true);
        expect(one.members, one.text).toContain(entry);
      }
      for (const entry of one.members)
        expect(Object.hasOwn(dictionary, entry), entry).toBe(true);
    }
  });

  const text = readFileSync(path.join(root, RELATED_TABLE_FILE), "utf8");
  const table = JSON.parse(text) as RelatedTable;

  it("the committed table was built from today's glosses", () => {
    expect(
      table.glossHash,
      "The dictionary or the Keys changed the glosses related words come from: rebuild the table with `pnpm enochian:hints related build --seed <new>` (or `--no-sample`; a build refuses to write over an existing sample), after `pnpm enochian:hints:run` if the gap hints have new glosses to embed, then judge a fresh sample (scripts/enochian-hints, plan 081's 2G build notes).",
    ).toBe(relatedHash(HINT_RECIPE, candidates));
  });

  it("the committed table is in its format, each entry's words its own", () => {
    expect(table.format).toBe(RELATED_TABLE_FORMAT);
    expect(table.recipe).toBe(HINT_RECIPE.id);
    expect(text).toBe(relatedTableText(table));
    expect(table.cutoff).toBeGreaterThanOrEqual(table.asked);
    const index = relatedIndex(table);
    expect(index.size).toBe(table.entries);
    expect([...index.values()].flat()).toHaveLength(table.items);
    const shown = new Set(candidates.map((one) => one.shown));
    for (const [entry, items] of index) {
      expect(Object.hasOwn(dictionary, entry), entry).toBe(true);
      expect(HUB_FORMS.has(fold(entry)), entry).toBe(false);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(MAX_RELATED);
      const opened = items.flatMap((item) =>
        item.forms.map((one) => one.entry),
      );
      expect(new Set(opened).size, entry).toBe(opened.length);
      for (const item of items) {
        expect(shown.has(item.gloss), item.gloss).toBe(true);
        // Never the entry itself, nor one of its own meanings.
        for (const one of item.forms) {
          expect(fold(one.entry), entry).not.toBe(fold(entry));
          expect(Object.hasOwn(dictionary, one.entry), one.entry).toBe(true);
        }
        const gloss = candidates.find(
          (one) =>
            one.shown === item.gloss &&
            item.forms.every((form) =>
              one.links.some((x) => x.entry === form.entry),
            ),
        );
        expect(gloss, item.gloss).toBeDefined();
        expect(gloss?.members, item.gloss).not.toContain(entry);
      }
    }
  });
});

describe("the judged sample the related words shipped on", () => {
  /** The held-out sample, judged after its cut-off was chosen (README). */
  const judgedFile = readFileSync(
    path.join(
      path.dirname(path.join(root, RELATED_TABLE_FILE)),
      "judged-z6.75-seed3.tsv",
    ),
    "utf8",
  );
  const drawnAt = Number(/table at z >= ([\d.]+)\./.exec(judgedFile)?.[1]);
  const seed = Number(/\(seed (\d+)\)/.exec(judgedFile)?.[1]);
  const table = JSON.parse(
    readFileSync(path.join(root, RELATED_TABLE_FILE), "utf8"),
  ) as RelatedTable;
  const { judged, unjudged } = readVerdicts(judgedFile);

  it("was drawn at the committed table's cut-off", () => {
    expect(drawnAt).toBe(6.75);
    expect(seed).toBe(3);
    expect(table.cutoff).toBe(drawnAt);
    expect(table.asked).toBe(drawnAt);
  });

  it("passes the bar, and every pair in it is the table's", () => {
    expect(unjudged).toBe(0);
    expect(judged).toHaveLength(SAMPLE_SIZE);
    expect(score(judged).all).toEqual({
      n: 200,
      good: 141,
      loose: 55,
      wrong: 4,
      passes: true,
    });
    const index = relatedIndex(table);
    const text = (item: RelatedItem) =>
      `${item.forms.map((one) => one.form).join(", ")} ‘${item.gloss}’`;
    for (const one of judged) {
      expect((index.get(one.word) ?? []).map(text), one.word).toContain(
        one.hint,
      );
      expect(one.z).toBeGreaterThanOrEqual(drawnAt);
    }
  });

  it("is the sample the table draws with its seed", () => {
    // The draw orders pairs by entry, then by the gloss's place among the
    // glosses; the build's places are those after `englishOnly`, which
    // keeps the candidates' order, so the candidates' places order them
    // alike without SCOWL.
    const translator = createTranslator(buildKeysTable(), dictionary);
    const place = new Map(
      hintGlosses(translator).map((one, at) => [one.shown, at]),
    );
    const pairs = [...relatedIndex(table)].flatMap(([entry, items]) =>
      items.map((item) => ({
        entry,
        gloss: place.get(item.gloss) as number,
        hint: `${item.forms.map((one) => one.form).join(", ")} ‘${item.gloss}’`,
      })),
    );
    for (const pair of pairs) expect(pair.gloss, pair.hint).toBeDefined();
    const drawn = sampleRelated(pairs, SAMPLE_SIZE, seed);
    expect(drawn.map((one) => [one.entry, one.hint])).toEqual(
      judged.map((one) => [one.word, one.hint]),
    );
  });
});
