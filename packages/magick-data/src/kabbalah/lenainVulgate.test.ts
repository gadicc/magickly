import { readFileSync } from "node:fs";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";

/**
 * Every verse Lenain prescribes, held to the Vulgate (plan 096, stage Y0).
 *
 * lenainQuotations.test.ts holds `psalm.la` to the page it was read from,
 * so a slip common to the page and the field passed. This holds the field
 * to the psalter as well: lenain/vulgate/verses.json5 is the Clementine
 * Vulgate's text of each genius's verse, and every place Lenain's Latin
 * differs from it is listed in lenain/vulgate/differences.json5, with what
 * the 1823 printing and Kircher read and whose the difference is. A new
 * difference, or a listed one that no longer differs, fails here.
 *
 * The comparison ignores case, accents, ligatures written out or not (æ
 * and ae), j for i, punctuation and where the words divide ("usque quo"
 * and "usquequo"), none of which is a reading. An apostrophe is kept: the
 * reissue's stray mark in "a me'ad" was taken for one.
 */

const read = (path: string) =>
  JSON5.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

interface Angel {
  no: number;
  psalm: { psalm: number; verse: number; la: string };
}

interface Verse {
  no: number;
  lenain: string;
  vulgate: string;
  text: string;
  printed: { leaf: number; page: number };
}

interface Difference {
  no: number;
  field: "psalm.la" | "psalm";
  kind: "wording" | "spelling" | "reference";
  ours: string;
  vulgate: string;
  print1823: { at: number; reads: string };
  kircher?: { leaf: number; page: number; reads: string };
  whose: "lenain" | "mixed" | "spelling";
  why: string;
}

const angels: Angel[] = read("./seventyTwoAngels.json5");
const verses: Verse[] = read("./lenain/vulgate/verses.json5");
const differences: Difference[] = read("./lenain/vulgate/differences.json5");

/** The letters that make a reading, as the comment above says. */
function letters(latin: string): string {
  return latin
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/j/g, "i")
    .replace(/[^a-z']/g, "");
}

const listed = (field: Difference["field"]) =>
  new Map(differences.filter((d) => d.field === field).map((d) => [d.no, d]));

describe("the verses held to the Vulgate", () => {
  it("has one verse for each genius, under Lenain's reference", () => {
    expect(verses.map((v) => v.no)).toEqual(angels.map((a) => a.no));
    for (const [i, angel] of angels.entries()) {
      const { psalm, verse } = angel.psalm;
      expect(verses[i].lenain, `genius ${angel.no}`).toBe(
        psalm === 0 ? "Genesis 1:1" : `Psalm ${psalm}:${verse}`,
      );
    }
  });

  it("finds every psalm.la in its verse, or lists why not", () => {
    const known = listed("psalm.la");
    const unlisted: string[] = [];
    const stale: number[] = [];
    let compared = 0;
    for (const angel of angels) {
      const ours = angel.psalm.la;
      if (!ours) continue;
      compared++;
      const verse = verses.find((v) => v.no === angel.no) as Verse;
      const agrees = letters(verse.text).includes(letters(ours));
      const entry = known.get(angel.no);
      if (agrees) {
        if (entry) stale.push(angel.no);
        continue;
      }
      if (entry?.ours !== ours)
        unlisted.push(
          `${angel.no}: "${ours}" vs ${verse.vulgate} "${verse.text}"`,
        );
    }
    expect(compared).toBe(71);
    expect(unlisted).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("names each verse's psalm as the Vulgate numbers it, or lists why not", () => {
    const known = listed("psalm");
    for (const angel of angels) {
      if (angel.psalm.psalm === 0) continue;
      const verse = verses.find((v) => v.no === angel.no) as Verse;
      const chapter = Number(verse.vulgate.match(/^Psalm (\d+):/)?.[1]);
      const entry = known.get(angel.no);
      if (chapter === angel.psalm.psalm) {
        expect(entry, `genius ${angel.no} is listed but agrees`).toBe(
          undefined,
        );
        continue;
      }
      expect(entry?.ours, `genius ${angel.no}`).toBe(String(angel.psalm.psalm));
      expect(entry?.vulgate, `genius ${angel.no}`).toBe(String(chapter));
    }
  });

  it("gives the seventieth genius Genesis 1:1, which his entry has only in French", () => {
    const jabamiah = angels.find((a) => a.no === 70) as Angel;
    expect(jabamiah.psalm).toEqual({ psalm: 0, verse: 0, la: "" });
    const verse = verses.find((v) => v.no === 70) as Verse;
    expect(verse.vulgate).toBe("Genesis 1:1");
    expect(verse.text).toBe("In principio creavit Deus cælum et terram.");
  });

  it("records what the 1823 printing reads, and whose each difference is", () => {
    const kinds = new Set(["wording", "spelling", "reference"]);
    const whose = new Set(["lenain", "mixed", "spelling"]);
    for (const d of differences) {
      const where = `genius ${d.no} ${d.field}`;
      expect(kinds.has(d.kind), where).toBe(true);
      expect(whose.has(d.whose), where).toBe(true);
      expect(d.kind === "spelling", where).toBe(d.whose === "spelling");
      expect(d.print1823.at, where).toBeGreaterThan(0);
      expect(d.print1823.reads, where).not.toBe("");
      expect(d.why, where).not.toBe("");
      // A difference is the 1823 printing's too, or it would be the
      // reissue's, corrected in the field and noted in the apparatus.
      if (d.field === "psalm.la")
        expect(letters(d.ours), where).toContain(letters(d.print1823.reads));
      else expect(d.print1823.reads, where).toBe(d.ours);
    }
  });
});
