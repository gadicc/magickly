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
}

const angels: Angel[] = read("./seventyTwoAngels.json5");
const french: string[] = read("./seventyTwoAngelsText/fr.json5");
const apparatus: Note[] = read("./lenain/apparatus.json5");

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

describe("the Latin this edition prints", () => {
  it("quotes every psalm as the page sets it, or says why not", () => {
    const noted = new Set(
      apparatus.filter((n) => n.field === "psalm.la").map((n) => n.no),
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
      if (noted.has(angel.no)) continue;
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
