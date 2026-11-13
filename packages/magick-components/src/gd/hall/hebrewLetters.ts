import hebrewLetters from "magick-data/hebrewLetters";

// The Golden Dawn's spellings of the letter names, beside magick-data's.
const GOLDEN_DAWN_SPELLINGS: [string, string][] = [
  ["aleph", "alef"],
  ["beth", "bet"],
  ["daleth", "dalet"],
  ["heh", "he"],
  ["vau", "vav"],
  ["zain", "zayin"],
  ["cheth", "het"],
  ["teth", "tet"],
  ["caph", "kaf"],
  ["kaph", "kaf"],
  ["peh", "pe"],
  ["tzaddi", "tsadi"],
  ["tzadi", "tsadi"],
  ["qoph", "qof"],
  ["koph", "qof"],
  ["tau", "tav"],
];

const byName = new Map<string, string>();
for (const row of Object.values(hebrewLetters)) {
  byName.set(row.id.toLowerCase(), row.letter.he);
  byName.set(row.letter.name.toLowerCase(), row.letter.he);
}
// Every id above is magick-data's; the tests check each spelling resolves.
for (const [alias, id] of GOLDEN_DAWN_SPELLINGS)
  byName.set(alias, byName.get(id) as string);

/**
 * The Hebrew character for a letter name (`shin`, `Resh`, `tzaddi`, `qoph`,
 * magick-data's `tsadi` or `kaf-sofit`) or for the character itself.
 * Anything else is `undefined`.
 */
export function hebrewLetter(name: string): string | undefined {
  if (/^[א-ת]$/.test(name)) return name;
  return byName.get(name.toLowerCase());
}

/** The Golden Dawn spellings accepted beside magick-data's names. */
export const HEBREW_LETTER_SPELLINGS: readonly string[] =
  GOLDEN_DAWN_SPELLINGS.map(([alias]) => alias);
