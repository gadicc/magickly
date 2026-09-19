import { readFileSync } from "node:fs";
import JSON5 from "json5";
import type { PlanetId } from "../../data/astrology/Planets";
import type { ChristianChoirs } from "../../data/kabbalah/ChristianChoirs";
import {
  choirOf,
  decadeOf,
  degreesOf,
  invocationOf,
  planetOf,
  presidingDaysOf,
} from "../../data/kabbalah/seventyTwoAngelsDerived";
import type { AngelExtraction } from "./schema";

/**
 * Compares what an entry literally prints against what Lenain's tables
 * require. A disagreement is a review item, never an accepted value: it means
 * the scan is damaged, or Lenain slipped, and either way somebody should look.
 */

const christianChoirs: ChristianChoirs = JSON5.parse(
  readFileSync("data/kabbalah/christianChoirs.json5", "utf8"),
);

/** What the book calls each planet, in Lenain's French and in English. */
const PLANET_WORDS: Record<PlanetId, string[]> = {
  sol: ["soleil", "sol", "sun"],
  luna: ["lune", "luna", "moon"],
  mars: ["mars"],
  mercury: ["mercure", "mercury"],
  venus: ["venus", "vénus"],
  jupiter: ["jupiter"],
  saturn: ["saturne", "saturn"],
  earth: ["terre", "earth"],
  uranus: ["uranus"],
  neptune: ["neptune"],
  rahu: ["rahu"],
  ketu: ["ketu"],
};

export interface Disagreement {
  no: number;
  field: string;
  scanned: string;
  derived: string;
}

/** Lowercased, unaccented and stripped of the scan's trailing punctuation. */
function plain(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The scan prints choirs and planets in the plural, and in French. */
function names(word: string) {
  const bare = plain(word);
  return bare.endsWith("s") ? [bare, bare.slice(0, -1)] : [bare, `${bare}s`];
}

export function disagreements(angel: AngelExtraction): Disagreement[] {
  const { no, scanned } = angel;
  const found: Disagreement[] = [];
  const note = (field: string, scannedAs: string, derived: string) =>
    found.push({ no, field, scanned: scannedAs, derived });

  const degrees = degreesOf(no);
  if (
    scanned.degrees.from !== degrees.from ||
    scanned.degrees.to !== degrees.to
  )
    note(
      "degrees",
      `${scanned.degrees.from}-${scanned.degrees.to}`,
      `${degrees.from}-${degrees.to}`,
    );

  if (scanned.decade !== decadeOf(no))
    note("decade", String(scanned.decade), String(decadeOf(no)));

  if (scanned.planet) {
    const expected = PLANET_WORDS[planetOf(no)];
    if (!expected.some((word) => plain(word) === plain(scanned.planet)))
      note("planet", scanned.planet, planetOf(no));
  }

  if (scanned.choir) {
    const choir = christianChoirs[choirOf(no) - 1];
    const accepted = [...names(choir.name.en), ...names(choir.name.fr)];
    if (!accepted.includes(plain(scanned.choir)))
      note("choir", scanned.choir, choir.name.en);
  }

  const presiding = presidingDaysOf(no);
  const asPrinted = scanned.presidingDays.map((d) => `${d.day}/${d.month}`);
  const asDerived = presiding.map(([month, day]) => `${day}/${month}`);
  if (asPrinted.join(", ") !== asDerived.join(", "))
    note("presidingDays", asPrinted.join(", "), asDerived.join(", "));

  const invocation = invocationOf(no);
  if (scanned.invocationFromMinutes !== invocation.from)
    note(
      "invocation",
      String(scanned.invocationFromMinutes),
      String(invocation.from),
    );

  return found;
}

/** Shape checks on the parts no arithmetic can confirm. */
export function shapeProblems(angel: AngelExtraction): string[] {
  const problems: string[] = [];
  const he = [...angel.name.he].filter((c) => /\p{Script=Hebrew}/u.test(c));

  if (he.length !== 5)
    problems.push(`name.he has ${he.length} Hebrew letters, not 5`);
  if (!/(יה|אל)$/.test(angel.name.he))
    problems.push(`name.he does not end in יה or אל: ${angel.name.he}`);
  if (!/^[A-Z]/.test(angel.name.en))
    problems.push(`name.en is not capitalised: ${angel.name.en}`);
  if (angel.text.fr.length < 400)
    problems.push(`text.fr is only ${angel.text.fr.length} characters`);
  if (angel.text.en.length < 400)
    problems.push(`text.en is only ${angel.text.en.length} characters`);
  // A repaired entry should have no page furniture left in it.
  if (/\(\s*\d{1,3}\s*\)\s*$/m.test(angel.text.fr))
    problems.push("text.fr still has a page number in it");

  return problems;
}
