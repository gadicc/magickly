import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { duplicateKeys, duplicateKeysInSources } from "./duplicateKeys";

/**
 * The [duplicate-key lint](./duplicateKeys.ts) on text written for it, since
 * the sources themselves are clean and must stay that way: the real ones are
 * asserted empty at the end, and everything before that is a scratch string
 * shaped like the fault it stands for.
 */

/** `amissio` as it was, with the first of its two titles already dead. */
const AMISSIO = `{
  // Loss.
  amissio: {
    id: "amissio",
    title: { en: "Loss" },   // the one JSON5 threw away
    rows: [2, 1, 2, 1],
    title: { en: "Amissio" },
  },
  acquisitio: {
    id: "acquisitio",
    title: { en: "Acquisitio" },
  },
}`;

describe("the duplicate-key lint", () => {
  it("finds the key a rewrite left behind", () => {
    expect(duplicateKeys(AMISSIO)).toEqual([{ path: "amissio", key: "title" }]);
  });

  it("keeps each object's keys to itself", () => {
    // `title` and `id` are in both rows above, and `en` in three objects.
    expect(duplicateKeys(AMISSIO)).toHaveLength(1);
    expect(
      duplicateKeys(
        `{ a: { en: 1 }, b: { en: 2 }, c: [{ en: 3 }, { en: 4 }] }`,
      ),
    ).toEqual([]);
  });

  it("names the object a nested duplicate is in", () => {
    expect(
      duplicateKeys(`{
        sephirah: {
          keter: {
            color: { queen: "white", queenWeb: "#fff", queen: "brilliance" },
            name: { en: "Crown", en: "Kether" },
          },
        },
        list: [
          { meaning: { en: "one" } },
          { meaning: { en: "two", en: "three" } },
        ],
      }`),
    ).toEqual([
      { path: "sephirah.keter.color", key: "queen" },
      { path: "sephirah.keter.name", key: "en" },
      { path: "list.1.meaning", key: "en" },
    ]);
  });

  it("counts a repeat at the top level of the file", () => {
    expect(duplicateKeys(`{ via: {}, populus: {}, via: {} }`)).toEqual([
      { path: "", key: "via" },
    ]);
  });

  it("reads a key however it is written", () => {
    // JSON5 quotes a key or leaves it bare, and either quote will do; two
    // spellings of one key are still one key.
    expect(
      duplicateKeys(`{ "planet/element": 1, 'planet/element': 2, no: 3 }`),
    ).toEqual([{ path: "", key: "planet/element" }]);
    expect(duplicateKeys(`{ no: 3, "no": 4 }`)).toEqual([
      { path: "", key: "no" },
    ]);
  });

  it("is not fooled by a comment or a string", () => {
    expect(
      duplicateKeys(`{
        // meaning: "commented out",
        /* meaning: "and this",
           meaning: "and this too" */
        meaning: { en: "a { b : c } and a \\" quote, and 'one' more" },
        note: "meaning: not a key",
        trailing: [1, 2,],
      }`),
    ).toEqual([]);

    // The same, with one real duplicate among the decoys.
    expect(
      duplicateKeys(`{
        // note: "commented out",
        note: "a: b",
        note: 'c: d',
      }`),
    ).toEqual([{ path: "", key: "note" }]);
  });

  it("stops at the end of the text, however it ends", () => {
    const one = [{ path: "", key: "a" }];
    // A last line comment with no newline after it, an unclosed block
    // comment, and a stray slash that begins neither.
    expect(duplicateKeys(`{ a: 1, a: 2 } // and nothing after`)).toEqual(one);
    expect(duplicateKeys(`{ a: 1, a: 2 } /* and nothing after`)).toEqual(one);
    expect(duplicateKeys(`{ a: 1, / a: 2 }`)).toEqual(one);
  });

  it("says which file a duplicate is in", () => {
    const dir = mkdtempSync(join(tmpdir(), "magickli-json5-"));
    try {
      writeFileSync(join(dir, "clean.json5"), `{ a: { x: 1 }, b: { x: 2 } }`);
      writeFileSync(join(dir, "broken.json5"), AMISSIO);
      writeFileSync(join(dir, "ignored.json"), `{ "a": 1, "a": 2 }`);
      expect(duplicateKeysInSources(dir)).toEqual([
        { file: "broken.json5", path: "amissio", key: "title" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds none in the sources as they stand", () => {
    expect(duplicateKeysInSources()).toEqual([]);
  });
});
