import { readFileSync } from "node:fs";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";

/**
 * Lenain's Latin, as he set it, against the Latin this edition prints.
 *
 * Each entry quotes a verse in brackets, and `psalm.la` is our field rather
 * than his line, so it carries the corrected reading where the two differ —
 * but only where the apparatus says so. Three successive reviews reported the
 * same silent repair on page 76, and a translation that quietly mends him
 * destroys the evidence the apparatus is built from. The rule is mechanical,
 * so this holds it rather than an instruction hoping to be followed.
 *
 * It reads the committed data, not `output/`, so it runs where the
 * extractions do not exist.
 */

const read = (path: string) =>
  JSON5.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

interface Angel {
  no: number;
  psalm?: { la?: string };
}

interface Note {
  no: number;
  field: string;
  printed: string;
  used: string;
}

const angels: Angel[] = read("./seventyTwoAngels.json5");
const french: string[] = read("./seventyTwoAngelsText/fr.json5");
const apparatus: Note[] = read("./lenain/apparatus.json5");
const vulgate: { no: number; text: string }[] = read(
  "./lenain/vulgate/verses.json5",
);

/** Letters and spacing only: brackets, accents and pointing are not readings. */
function plain(latin: string) {
  return latin
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The bracketed run in the entry that this quotation was taken from. */
function asPrinted(entry: string, ours: string) {
  const words = new Set(plain(ours).split(" "));
  let best = "";
  let bestShare = 0;
  for (const run of entry.match(/\(([^()]{20,400})\)/g) ?? []) {
    const printed = plain(run.slice(1, -1));
    const parts = printed.split(" ");
    const share = parts.filter((w) => words.has(w)).length / parts.length;
    if (share > bestShare) {
      bestShare = share;
      best = printed;
    }
  }
  return bestShare > 0.5 ? best : null;
}

/**
 * The words one text has and the other does not, in order: what is left of
 * each after their longest common run of words is taken out.
 */
function difference(page: string[], ours: string[]) {
  const longest = page.map(() => new Array<number>(ours.length + 1).fill(0));
  longest.push(new Array<number>(ours.length + 1).fill(0));
  for (let i = page.length - 1; i >= 0; i--)
    for (let j = ours.length - 1; j >= 0; j--)
      longest[i][j] =
        page[i] === ours[j]
          ? longest[i + 1][j + 1] + 1
          : Math.max(longest[i + 1][j], longest[i][j + 1]);
  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < page.length && j < ours.length) {
    if (page[i] === ours[j]) {
      i++;
      j++;
    } else if (longest[i + 1][j] >= longest[i][j + 1]) removed.push(page[i++]);
    else added.push(ours[j++]);
  }
  return {
    removed: [...removed, ...page.slice(i)],
    added: [...added, ...ours.slice(j)],
  };
}

/** The words of the psalter's verse as `plain` gives them, j as i. */
const psalter = (text: string) => plain(text).replace(/j/g, "i").split(" ");

/** Whether every word of `words` is one of `allowed`, each used once. */
function within(words: string[], allowed: string[]) {
  const left = [...allowed];
  return words.every((word) => {
    const at = left.indexOf(word);
    if (at < 0) return false;
    left.splice(at, 1);
    return true;
  });
}

describe("the Latin this edition prints", () => {
  it("quotes every psalm as the page sets it, or says why not", () => {
    // A note excuses only the change it records, and only towards the
    // psalter: each word the page has and the field does not must be in the
    // note's `printed` and not in the Vulgate's verse, and each word the
    // field has instead must be in its `used` and in the verse. Everything
    // else in the field is still held to the page, so a word dropped or
    // changed elsewhere in a noted verse fails.
    const noted = new Map(
      apparatus.filter((n) => n.field === "psalm.la").map((n) => [n.no, n]),
    );

    const silent: string[] = [];
    let compared = 0;
    for (const angel of angels) {
      const ours = angel.psalm?.la;
      if (!ours) continue;
      const printed = asPrinted(french[angel.no - 1] ?? "", ours);
      if (printed === null) continue;
      compared++;
      if (printed === plain(ours)) continue;
      const note = noted.get(angel.no);
      if (note) {
        const { removed, added } = difference(
          printed.split(" "),
          plain(ours).split(" "),
        );
        const verse = new Set(
          psalter(vulgate.find((v) => v.no === angel.no)?.text ?? ""),
        );
        if (
          within(removed, plain(note.printed).split(" ")) &&
          within(added, plain(note.used).split(" ")) &&
          removed.every((word) => !verse.has(word.replace(/j/g, "i"))) &&
          added.every((word) => verse.has(word.replace(/j/g, "i")))
        )
          continue;
        silent.push(
          `${angel.no}: page has "${removed.join(" ")}" and ours "${added.join(" ")}", beyond its note's "${note.printed}" → "${note.used}"`,
        );
        continue;
      }
      silent.push(`${angel.no}: page "${printed}" vs ours "${plain(ours)}"`);
    }

    // Enough entries must be reachable for the check to mean anything.
    expect(compared).toBeGreaterThan(60);
    expect(silent).toEqual([]);
  });

  it("keeps the printed reading in the French even where the field is corrected", () => {
    // Page 76 sets "adjuvebat" where the psalter reads "adiuvabat". The
    // apparatus notes it and `psalm.la` gives the psalter's form; the French
    // must still be his.
    const noted = apparatus.find(
      (n) => n.field === "psalm.la" && n.no === 45,
    ) as (Note & { printed: string; used: string }) | undefined;
    expect(noted?.used).toBe("adjuvabat");
    expect(french[44]).toContain("adjuvebat");
    expect(angels.find((a) => a.no === 45)?.psalm?.la).toContain("adjuvabat");
  });
});
