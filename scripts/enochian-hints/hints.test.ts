import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { appendCache, readCache } from "./cache.ts";
import type { HintGloss } from "./glosses.ts";
import {
  bestGloss,
  cacheKey,
  embeddingText,
  HINT_RECIPE,
  type HintRecipe,
} from "./recipe.ts";
import {
  extractScowl,
  readLists,
  SCOWL_LISTS,
  SCOWL_RELEASE,
  scowlWords,
  sha256File,
  verifyArchive,
  WORD_CHECK_LISTS,
} from "./scowl.ts";
import {
  carryVerdicts,
  fitBudget,
  type Judged,
  judgedHint,
  lowestPassing,
  readVerdicts,
  roundCut,
  type Scored,
  sampleFile,
  sampleHints,
  sampleName,
  score,
  scoreWords,
  servedBytes,
  shares,
  tableAt,
  writeNewSample,
} from "./table.ts";

const scratch = mkdtempSync(path.join(tmpdir(), "enochian-hints-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const HEAD = {
  notice: "test notice",
  source: "test",
  recipe: HINT_RECIPE.id,
  asked: 5.5,
  glossHash: "0",
};

/** A tiny SCOWL archive: the release's layout, with made-up lists. */
function fixtureArchive(): string {
  const dir = path.join(scratch, "fixture");
  const final = path.join(dir, SCOWL_RELEASE.root, "final");
  mkdirSync(final, { recursive: true });
  writeFileSync(path.join(dir, SCOWL_RELEASE.root, "Copyright"), "notice\n");
  for (const list of WORD_CHECK_LISTS)
    writeFileSync(path.join(final, list), "");
  writeFileSync(
    path.join(final, "english-words.10"),
    Buffer.concat([
      Buffer.from("dawn\r\nAaron\naardvark's\nco-op\nmaster\n"),
      // "café" as SCOWL writes it, in ISO-8859-1.
      Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]),
    ]),
  );
  writeFileSync(path.join(final, "british-words.35"), "colour\ndawn\n");
  writeFileSync(path.join(final, "english-proper-names.35"), "london\n");
  const archive = path.join(scratch, "scowl.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", dir, SCOWL_RELEASE.root]);
  return archive;
}

describe("SCOWL (plan 081, S11)", () => {
  const archive = fixtureArchive();
  const pin = { bytes: statSync(archive).size, sha256: sha256File(archive) };

  it("refuses an archive that isn't the pinned one", () => {
    expect(() => verifyArchive(archive)).toThrow(/not the pinned/);
    expect(() =>
      verifyArchive(archive, { bytes: pin.bytes, sha256: "0".repeat(64) }),
    ).toThrow(/SHA-256 .* refusing it/);
    expect(() => verifyArchive(archive, pin)).not.toThrow();
  });

  it("pins the release's own archive", () => {
    expect(SCOWL_RELEASE).toMatchObject({
      bytes: 2_569_810,
      sha256:
        "5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc",
    });
    expect(SCOWL_LISTS).toHaveLength(12);
    expect(SCOWL_LISTS.join(" ")).not.toMatch(
      /names|abbreviations|contractions|upper|variant/,
    );
  });

  it("extracts only the lists and the notice, and keeps plain lower-case words", () => {
    const release = extractScowl(archive, path.join(scratch, "out"));
    expect(existsSync(path.join(release, "Copyright"))).toBe(true);
    expect(
      existsSync(path.join(release, "final", "english-proper-names.35")),
    ).toBe(false);
    expect(scowlWords(readLists(release))).toEqual([
      "colour",
      "dawn",
      "master",
    ]);
  });
});

describe("the recipe (similarity/bare)", () => {
  it("prompts a word and a gloss alike, with the site's model", () => {
    expect(embeddingText(HINT_RECIPE, "dawn")).toBe(
      "task: sentence similarity | query: dawn",
    );
    expect(HINT_RECIPE.profile).toMatchObject({
      model: "google/gemini-embedding-2",
      dimensions: 768,
    });
  });

  it("keys the cache by the exact input and the model", () => {
    const input = embeddingText(HINT_RECIPE, "dawn");
    expect(cacheKey(HINT_RECIPE, input)).toBe(cacheKey(HINT_RECIPE, input));
    expect(cacheKey(HINT_RECIPE, `${input} `)).not.toBe(
      cacheKey(HINT_RECIPE, input),
    );
    const other: HintRecipe = {
      ...HINT_RECIPE,
      profile: { ...HINT_RECIPE.profile, model: "another/model" },
    };
    expect(cacheKey(other, input)).not.toBe(cacheKey(HINT_RECIPE, input));
  });

  it("takes the best gloss by cosine and its z-score against them all", () => {
    const r = Math.SQRT1_2;
    // Four unit glosses in three dimensions.
    const glosses = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, r, r, 0]);
    const best = bestGloss(Float32Array.from([1, 0, 0]), glosses, 3);
    const dots = [1, 0, 0, r];
    const mean = dots.reduce((a, b) => a + b) / 4;
    const sd = Math.sqrt(dots.reduce((a, b) => a + (b - mean) ** 2, 0) / 4);
    expect(best.gloss).toBe(0);
    expect(best.cosine).toBeCloseTo(1, 6);
    expect(best.z).toBeCloseTo((1 - mean) / sd, 5);
    // A query between two glosses: the one they share wins, standing out
    // less from the rest.
    const between = bestGloss(Float32Array.from([r, r, 0]), glosses, 3);
    expect(between.gloss).toBe(3);
    expect(between.z).toBeLessThan(best.z);
  });
});

const GLOSSES: HintGloss[] = [
  { text: "sunrise", shown: "sunrise", forms: ["RNAH"] },
  { text: "king", shown: "a King", forms: ["REGE"] },
  { text: "fire", shown: "fire", forms: ["PRGE", "IALPOR"] },
];

describe("the table", () => {
  it("scores fake vectors and keeps only words at or above the cut-off", () => {
    const vectors: Record<string, number[]> = {
      sunrise: [1, 0, 0, 0],
      king: [0, 1, 0, 0],
      fire: [0, 0, 1, 0],
      dawn: [0.9, 0.1, 0, 0.1],
      monarch: [0.1, 0.95, 0, 0.1],
      emu: [0.3, 0.3, 0.3, 0.85],
    };
    const vectorOf = (text: string) => {
      const v = vectors[text];
      const n = Math.hypot(...v);
      return Float32Array.from(v.map((x) => x / n));
    };
    const scored = scoreWords(["dawn", "monarch", "emu"], GLOSSES, vectorOf, 4);
    expect(scored.map((one) => [one.word, GLOSSES[one.gloss].text])).toEqual([
      ["dawn", "sunrise"],
      ["monarch", "king"],
      ["emu", expect.any(String)],
    ]);
    // Cut at the lower of the two near words' z-scores: the emu, near
    // nothing, falls below it.
    const cut = Math.min(scored[0].z, scored[1].z);
    expect(scored[2].z).toBeLessThan(cut);
    const table = tableAt(scored, GLOSSES, cut, HEAD);
    expect(table.rows).toBe(2);
    expect(table.cutoff).toBe(cut);
    // Each gloss in its own wording, as a reader sees it.
    expect(table.hints).toEqual([
      ["sunrise", ["RNAH"], "dawn"],
      ["a King", ["REGE"], "monarch"],
    ]);
    expect(table.notice).toBe("test notice");
  });

  /** Many made-up words, z from 5.5 to about 9.5, over three glosses. */
  const many: Scored[] = Array.from({ length: 4000 }, (_, at) => ({
    word: `w${(at * 7919) % 100000}x${at}`,
    gloss: at % 3,
    cosine: 0.9,
    z: 5.5 + at / 1000,
  }));

  it("keeps the asked cut-off when the table fits its budget", () => {
    const table = fitBudget(many, GLOSSES, HEAD, 10_000_000);
    expect(table.cutoff).toBe(5.5);
    expect(table.rows).toBe(many.length);
  });

  it("raises the cut-off a step at a time until the table fits", () => {
    const budget = servedBytes(tableAt(many, GLOSSES, 7.5, HEAD)).gzip;
    const table = fitBudget(many, GLOSSES, HEAD, budget);
    const cutoff = table.cutoff as number;
    expect(servedBytes(table).gzip).toBeLessThanOrEqual(budget);
    expect(cutoff).toBeGreaterThan(5.5);
    expect(cutoff).toBeLessThanOrEqual(7.5);
    // A tenth lower would not have fitted.
    const lower = tableAt(
      many,
      GLOSSES,
      Number((cutoff - 0.1).toFixed(6)),
      HEAD,
    );
    expect(servedBytes(lower).gzip).toBeGreaterThan(budget);
    expect(String(cutoff)).toMatch(/^\d+\.\d$/);
  });

  it("draws the same 200 distinct hints for the same table", () => {
    const one = sampleHints(many);
    expect(one).toHaveLength(200);
    expect(new Set(one.map((hint) => hint.word)).size).toBe(200);
    expect(sampleHints(many)).toEqual(one);
    expect(one.map((hint) => hint.word)).toEqual(
      one.map((hint) => hint.word).sort(),
    );
    expect(sampleHints(many.slice(0, 50))).toHaveLength(50);
  });
});

describe("the judges' file and the scorer", () => {
  /** n judged hints: z from 5.5 up; the lowest `wrong` wrong, the rest good. */
  const judged = (n: number, wrong: number, loose = 0): Judged[] =>
    Array.from({ length: n }, (_, at) => ({
      word: `w${at}`,
      z: 5.5 + at / 100,
      verdict: at < wrong ? "wrong" : at < wrong + loose ? "loose" : "good",
    }));

  it("writes the sample to judge and reads the verdicts back", () => {
    const sample: Scored[] = [
      { word: "dawn", gloss: 0, cosine: 0.9, z: 7.25 },
      { word: "monarch", gloss: 1, cosine: 0.9, z: 6.1 },
      { word: "emu", gloss: 2, cosine: 0.9, z: 5.6 },
    ];
    const file = sampleFile(sample, GLOSSES, 5.5, 82);
    expect(file).toContain("(seed 82)");
    expect(file).toContain("dawn\trelated: RNAH ‘sunrise’\t7.250000\t");
    expect(file).toContain("emu\trelated: PRGE, IALPOR ‘fire’\t5.600000\t");
    const filled = file
      .replace("7.250000\t", "7.250000\tgood")
      .replace("6.100000\t", "6.100000\tl");
    expect(readVerdicts(filled)).toEqual({
      judged: [
        {
          word: "dawn",
          z: 7.25,
          verdict: "good",
          hint: "related: RNAH ‘sunrise’",
        },
        {
          word: "monarch",
          z: 6.1,
          verdict: "loose",
          hint: "related: REGE ‘a King’",
        },
      ],
      unjudged: 1,
    });
    expect(() =>
      readVerdicts(file.replace("7.250000\t", "7.250000\tmaybe")),
    ).toThrow(/Can't read/);
    expect(sampleName(82, 6.25)).toBe("sample-seed82-z6.25.tsv");
    // A sample is never written over.
    const at = path.join(scratch, "samples", sampleName(82, 6.25));
    writeNewSample(at, filled);
    expect(() => writeNewSample(at, file)).toThrow(/exists/);
    expect(readFileSync(at, "utf8")).toBe(filled);
  });

  it("ships at 90% good or loose and at most 5% wrong", () => {
    expect(score(judged(200, 10, 30))).toEqual({
      all: { n: 200, good: 160, loose: 30, wrong: 10, passes: true },
    });
    // 11 wrong of 200 is 5.5%.
    expect(score(judged(200, 11)).all.passes).toBe(false);
  });

  it("names the lowest cut-off at which the judged sample would pass", () => {
    const result = score(judged(200, 30));
    expect(result.all.passes).toBe(false);
    // Dropping the lowest 22 leaves 8 wrong of 178 (4.5%); 21 would
    // leave 9 of 179 (5.03%).
    expect(result.raise).toEqual({
      cutoff: 5.72,
      shares: { n: 178, good: 170, loose: 0, wrong: 8, passes: true },
    });
    expect(score([{ word: "a", z: 9, verdict: "wrong" }]).raise).toBeNull();
  });

  it("reports exactly the shares of the table built at the cut-off it names", () => {
    // The judged hints pass from the wrong one at 6.235 up (1 of 21);
    // rounded to 6.23, the cut-off would keep the wrong one at 6.231 too
    // (2 of 22, failing), so it is rounded to 6.235 instead.
    const list: Judged[] = [
      { word: "a", z: 6.231, verdict: "wrong" },
      { word: "b", z: 6.235, verdict: "wrong" },
      ...Array.from({ length: 20 }, (_, at) => ({
        word: `c${at}`,
        z: 7 + at,
        verdict: "good" as const,
      })),
    ];
    const cut = lowestPassing(list);
    expect(cut?.cutoff).toBe(6.235);
    expect(cut?.shares).toEqual(
      shares(list.filter((one) => one.z >= (cut?.cutoff ?? 0))),
    );
    expect(cut?.shares).toMatchObject({ n: 21, wrong: 1, passes: true });
    // Room below the cut: two places.
    expect(roundCut(6.2391, [{ z: 6.1 }, { z: 6.2391 }])).toBe(6.23);
    expect(roundCut(6.2391, [{ z: 6.2301 }, { z: 6.2391 }])).toBe(6.239);
    expect(roundCut(6.23915, [{ z: 6.2391 }, { z: 6.23915 }])).toBe(6.23915);
  });

  it("carries a verdict over only to a hint left as it was judged", () => {
    const judgedList: Judged[] = [
      {
        word: "dawn",
        z: 5.6,
        verdict: "good",
        hint: "related: RNAH ‘sunrise’",
      },
      {
        word: "monarch",
        z: 5.7,
        verdict: "loose",
        hint: "related: REGE ‘king’",
      },
      { word: "emu", z: 5.8, verdict: "wrong", hint: "related: X ‘bird’" },
      { word: "gone", z: 5.9, verdict: "wrong", hint: "related: X ‘bird’" },
    ];
    const scored: Scored[] = [
      { word: "dawn", gloss: 0, cosine: 0.9, z: 6.4 },
      { word: "monarch", gloss: 1, cosine: 0.9, z: 6.1 },
      { word: "emu", gloss: 2, cosine: 0.9, z: 6.0 },
    ];
    const { carried, changed } = carryVerdicts(judgedList, scored, GLOSSES);
    // "king" was judged under its embedded wording; now shown "a King".
    expect(carried).toEqual([
      {
        word: "dawn",
        z: 6.4,
        verdict: "good",
        hint: "related: RNAH ‘sunrise’",
      },
      {
        word: "monarch",
        z: 6.1,
        verdict: "loose",
        hint: "related: REGE ‘a King’",
      },
    ]);
    expect(changed).toEqual(["emu", "gone"]);
    expect(judgedHint("related: PRGE, IALPOR ‘fire’")).toEqual({
      forms: ["PRGE", "IALPOR"],
      gloss: "fire",
    });
  });
});

describe("the vector cache", () => {
  it("keeps every batch, and reads past a line an interrupted write cut short", () => {
    const file = path.join(scratch, "cache", "vectors.jsonl");
    const cache = readCache(file, 2);
    expect(cache.vectors.size).toBe(0);
    appendCache(file, cache, [["a", [0.6, 0.8]]]);
    appendFileSync(file, '{"k":"b","v":"AAAA');
    appendCache(file, cache, [["c", [1, 0]]]);
    const read = readCache(file, 2);
    expect([...read.vectors.keys()]).toEqual(["a", "c"]);
    expect([...(read.vectors.get("a") ?? [])]).toEqual([
      Math.fround(0.6),
      Math.fround(0.8),
    ]);
    expect(read.skipped).toBe(1);
    expect(readCache(file, 3).vectors.size).toBe(0);
  });
});
