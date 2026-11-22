import type { KameaPlanetId } from "magick-data/astrology/kameas";
import planetaryNames, {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryNameWitness,
  readingOf,
  tracedSpelling,
} from "magick-data/astrology/planetaryNames";
import { canonicalKameaSigilText } from "@/render/contracts/kameaSigil";

/** One spelling of a planet's name the generator offers to trace. */
export interface KameaSigilName {
  /** The name's row (`agiel`, `malcha-betharsisim`). */
  id: string;
  /** Its name as the site shows it (`name.roman`). */
  roman: string;
  /** The Hebrew traced, its words spaced. */
  he: string;
  /**
   * The witness this spelling is another witness's, where it is not the
   * traced spelling (Agrippa 1533's, divided as plan 093 divides it).
   */
  witness?: PlanetaryNameWitness;
}

/**
 * Every name the planetary names table gives `planet` (its divine names,
 * intelligences and spirits, in the table's order), each in the spelling
 * the reference pages trace (`tracedSpelling`), then each other witness's
 * spelling that differs from every one before it, labelled with its
 * witness (plan 093, decision 6: Jupiter's יופיל, Mars' ברצבאל, 777's
 * Moon). A name no witness spells (Shelachel) has none, and a spelling
 * the image contract would not take is left out.
 */
export function kameaSigilNames(planet: KameaPlanetId): KameaSigilName[] {
  const names: KameaSigilName[] = [];
  for (const row of Object.values(planetaryNames)) {
    if (row.planetId !== planet) continue;
    const traced = tracedSpelling(row);
    if (!traced) continue;
    const seen = new Set([traced]);
    names.push({ id: row.id, roman: row.name.roman, he: traced });
    for (const witness of PLANETARY_NAME_WITNESSES) {
      const he = readingOf(row, witness)?.he;
      // Only what the image contract takes, as the generator does.
      if (!he || seen.has(he) || canonicalKameaSigilText(he) !== he) continue;
      seen.add(he);
      names.push({ id: row.id, roman: row.name.roman, he, witness });
    }
  }
  return names;
}

/** Each witness as the name list labels it, as the reference pages do. */
export { WITNESS_LABELS } from "../witnesses";
