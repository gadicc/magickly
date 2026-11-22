import { traceHebrew } from "magick-data/astrology/aiqBekar";
import type { KameaPlanetId } from "magick-data/astrology/kameas";
import characterRows, {
  type PlanetaryNameCharacter,
} from "magick-data/astrology/planetaryNameCharacters";
import exceptionRows, {
  type PlanetaryNameException,
} from "magick-data/astrology/planetaryNameExceptions";
import nameRows, {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryName,
  type PlanetaryNameWitness,
  readingOf,
  tracedSpelling,
} from "magick-data/astrology/planetaryNames";
import { canonicalKameaSigilText } from "@/render/contracts/kameaSigil";
import { constantOf } from "./kameaPlanets";

/**
 * The planetary names as the reference pages show them (plan 093, K4):
 * a planet's names in the table's order, what each is to its planet, where
 * a name's own page is, and the exceptions to its printed numbers. Shared
 * by the kamea pages and the names' pages.
 */

export type { PlanetaryName, PlanetaryNameException };

/** What a name is to its planet: the table's `role`. */
export type PlanetaryNameRole = PlanetaryName["role"];

/** Each role as a names table labels it. */
export const ROLE_LABELS: Record<PlanetaryNameRole, string> = {
  divineName: /*i18n*/ "Divine name",
  intelligence: /*i18n*/ "Intelligence",
  intelligences: /*i18n*/ "Intelligences",
  spirit: /*i18n*/ "Spirit",
  intelligenceOfIntelligences: /*i18n*/ "Intelligence of intelligences",
  spiritOfSpirits: /*i18n*/ "Spirit of spirits",
};

/** A planet's names, in the table's order: divine names first. */
export function planetaryNamesOf(planet: KameaPlanetId): PlanetaryName[] {
  return Object.values(nameRows).filter((row) => row.planetId === planet);
}

/** A name by its id, or undefined (own keys only). */
export function planetaryName(id: string): PlanetaryName | undefined {
  return Object.hasOwn(nameRows, id)
    ? nameRows[id as keyof typeof nameRows]
    : undefined;
}

/**
 * The two namespaces the names' pages live in (plan 093, decision 8): an
 * intelligence's, the Bne Seraphim's and the Moon's intelligence of
 * intelligences under `/astrology/intelligence`, a spirit's and the
 * spirit of spirits' under `/astrology/spirit`.
 */
export type PlanetaryNamePageKind = "intelligence" | "spirit";

const PAGE_KINDS: Record<PlanetaryNameRole, PlanetaryNamePageKind | null> = {
  divineName: null,
  intelligence: "intelligence",
  intelligences: "intelligence",
  intelligenceOfIntelligences: "intelligence",
  spirit: "spirit",
  spiritOfSpirits: "spirit",
};

/**
 * Whether a name has a page of its own, and in which namespace: the names
 * with a sigil (decision 1), the intelligences and spirits a witness
 * spells. A divine name has none (it is traced in the generator only), nor
 * has Shelachel, whom no witness spells and nothing traces.
 */
export function planetaryNamePageKind(
  name: PlanetaryName,
): PlanetaryNamePageKind | null {
  return tracedSpelling(name) ? PAGE_KINDS[name.role] : null;
}

/** A name's own page, `/astrology/spirit/zazel`, or null for none. */
export function planetaryNamePath(name: PlanetaryName): string | null {
  const kind = planetaryNamePageKind(name);
  return kind ? `/astrology/${kind}/${name.id}` : null;
}

/** Every name that has a page, in the table's order. */
export function planetaryNamesWithPages(): PlanetaryName[] {
  return Object.values(nameRows).filter((row) => planetaryNamePageKind(row));
}

/**
 * The exceptions to a name's printed numbers, one per witness at most,
 * in the table's order (`planetaryNameExceptions`): the rows the page
 * renders, so that what it says and what the data test holds are one.
 */
export function exceptionsOf(name: PlanetaryName): PlanetaryNameException[] {
  return Object.values(exceptionRows).filter(
    (row) => row.planetaryNameId === name.id,
  );
}

/** The exception to a witness's number for a name, if there is one. */
export function exceptionOf(
  name: PlanetaryName,
  witness: PlanetaryNameWitness,
): PlanetaryNameException | undefined {
  return exceptionsOf(name).find((row) => row.witness === witness);
}

/**
 * A name's Hebrew as Agrippa prints it in 1533, which is the spelling the
 * pages lead with and trace (decision 6), as one word where he prints one
 * (the spirit of spirits, which `tracedSpelling` divides); undefined for
 * Shelachel.
 */
export const agrippaHebrew = (name: PlanetaryName) =>
  readingOf(name, "agrippa1533")?.he;

export { readingOf, tracedSpelling };

/**
 * The name on a page of a namespace, or undefined: `agiel` under
 * `intelligence`, but not under `spirit`, nor any name without a page.
 */
export function planetaryNameOnPage(
  kind: PlanetaryNamePageKind,
  id: string,
): PlanetaryName | undefined {
  const name = planetaryName(id);
  return name && planetaryNamePageKind(name) === kind ? name : undefined;
}

/** The planet a name belongs to, as the squares are keyed. */
export const planetOfName = (name: PlanetaryName) =>
  name.planetId as KameaPlanetId;

/**
 * Agrippa's romanisation of 1533, where it is not the name the site gives
 * (`name.roman`): Barzabel beside Bartzabel, Iohphiel beside Iophiel.
 * Undefined where they agree or he gives none.
 */
export function agrippaRoman(name: PlanetaryName): string | undefined {
  const roman = readingOf(name, "agrippa1533")?.roman;
  return roman && plain(roman) !== plain(name.name.roman) ? roman : undefined;
}

/** A romanisation without its accents and case: Hismaël is Hismael. */
const plain = (roman: string) =>
  roman
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase();

/**
 * The number a name stands for on its square: the one Agrippa prints,
 * unless that is a slip and the letters give one of the square's numbers
 * (Kedemel's 157 for 175), so that a page does not lead with the slip.
 */
export function squareNumberOf(name: PlanetaryName): number | undefined {
  const printed = readingOf(name, "agrippa1533")?.number;
  const planet = planetOfName(name);
  const exception = exceptionOf(name, "agrippa1533");
  return printed !== undefined &&
    !constantOf(planet, printed) &&
    exception &&
    constantOf(planet, exception.expected)
    ? exception.expected
    : printed;
}

/** Another witness's spelling of a name, which traces otherwise. */
export interface OtherSpelling {
  /** The Hebrew, as the witnesses print it. */
  he: string;
  /** The witnesses that spell it so, earliest first. */
  witnesses: PlanetaryNameWitness[];
  /**
   * The exception rows that leave whose the spelling is unsettled (777's
   * Moon, 1651's Taphthartharath), which the page shows with it.
   */
  unsettled: PlanetaryNameException[];
}

/** A spelling's trace, as a key: the cells, word by word. */
const traceKey = (he: string, planet: KameaPlanetId) =>
  JSON.stringify(traceHebrew(he, planet));

/**
 * The other witnesses' spellings of a name whose traces differ from the
 * traced spelling's (plan 093, decision 6: Jupiter's יופיל, Mars' ברצבאל,
 * 777's Moon), each once, with every witness that prints it; finals at
 * their ordinary values, as the pages trace them (decision 3). A spelling
 * an exception row calls a slip, the printer's or one taken over from an
 * earlier printing, is not traced: it stays in the witnesses' list with
 * its note. One whose row leaves it unsettled is traced, with that row.
 * A spelling the image contract would refuse is left out, as the
 * generator leaves it.
 */
export function otherSpellings(name: PlanetaryName): OtherSpelling[] {
  const traced = tracedSpelling(name);
  if (!traced) return [];
  const planet = planetOfName(name);
  const tracedKey = traceKey(traced, planet);
  const spellings = new Map<string, OtherSpelling>();
  for (const witness of PLANETARY_NAME_WITNESSES) {
    if (witness === "agrippa1533") continue;
    const he = readingOf(name, witness)?.he;
    if (!he || canonicalKameaSigilText(he) !== he) continue;
    if (traceKey(he, planet) === tracedKey) continue;
    const exception = exceptionOf(name, witness);
    if (exception && exception.whose !== "unsettled") continue;
    const seen = spellings.get(he) ?? { he, witnesses: [], unsettled: [] };
    seen.witnesses.push(witness);
    if (exception) seen.unsettled.push(exception);
    spellings.set(he, seen);
  }
  return [...spellings.values()];
}

export type { PlanetaryNameCharacter };

/** The two printings whose characters K6 read. */
export type CharacterWitness = "agrippa1533" | "regardie1940";

/**
 * A name's character as a printing draws it, with our verdict on it
 * (`planetaryNameCharacters`, plan 093, K6), or undefined where the table
 * has none.
 */
export function characterOf(
  name: PlanetaryName,
  witness: CharacterWitness,
): PlanetaryNameCharacter | undefined {
  const key = `${name.id}-${witness}`;
  return Object.hasOwn(characterRows, key)
    ? characterRows[key as keyof typeof characterRows]
    : undefined;
}
