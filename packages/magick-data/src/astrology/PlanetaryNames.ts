import rows from "../../dist/astrology/planetaryNames.js";
import type { Links, Raw } from "../types.ts";

/** A name's key: `agiel`, `saturn-ab`, `malcha-betharsisim`. */
type PlanetaryNameId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type PlanetaryName = Raw<"planetaryName"> &
  Partial<Links<"*", "planetaryName">>;

/** Every name, by key. */
type PlanetaryNames = Record<PlanetaryNameId, PlanetaryName>;

/**
 * The witnesses to the names, as a row's `witnesses` keys them, earliest
 * first: Agrippa's *De occulta philosophia* (Cologne, 1533), its English
 * translation (London, 1651), Barrett's *The Magus* (1801), Crowley's *777
 * Revised* (1955) and Regardie's *The Golden Dawn*, vol. 4 (1940). The data
 * file's header cites the copy and leaves read of each. A new witness is a
 * new key; no name's id moves.
 */
const PLANETARY_NAME_WITNESSES: readonly [
  "agrippa1533",
  "agrippa1651",
  "barrett1801",
  "crowley777",
  "regardie1940",
] = Object.freeze([
  "agrippa1533",
  "agrippa1651",
  "barrett1801",
  "crowley777",
  "regardie1940",
] as const);

/** A witness to the planetary names. */
type PlanetaryNameWitness = (typeof PLANETARY_NAME_WITNESSES)[number];

/**
 * How a printed number is reached where it is not the plain sum of the
 * name's letters: `finals`, the final letters at 500 to 900; `pairs`, each
 * pair of letters makes it, as Asboga's 8 does three times.
 */
type PlanetaryNameCount = "finals" | "pairs";

/**
 * One witness's reading of a name: what it prints, every field optional.
 * The data file's header says what each holds. Stated here rather than read
 * off the rows, whose readings differ in shape from witness to witness.
 */
interface PlanetaryNameReading {
  /** The Hebrew, final letters as printed, its words spaced. */
  readonly he?: string;
  /** The name in roman type, as printed. */
  readonly roman?: string;
  /** The words printed with the name to say what it is. */
  readonly caption?: string;
  /** The number printed beside it. */
  readonly number?: number;
  /** How the number is reached, where it is not the plain sum. */
  readonly count?: PlanetaryNameCount;
  /**
   * The archive.org item the reading was made in, where it is not the one
   * the data file's header names for the witness (another copy).
   */
  readonly item?: string;
  /** The archive.org leaf it is printed on, `n163`, in `item` if given. */
  readonly leaf?: string;
  /** An uncertain reading or a detail of the page. */
  readonly note?: string;
}

/** A witness's reading of a name, or `undefined` where it gives none. */
function readingOf(
  name: PlanetaryName,
  witness: PlanetaryNameWitness,
): PlanetaryNameReading | undefined {
  // The schema holds `count` to the two values; the declaration widens it.
  return name.witnesses[witness] as PlanetaryNameReading | undefined;
}

/**
 * The Hebrew a name is traced in (plan 093, decision 6): Agrippa's 1533
 * spelling, divided into words where the row gives our `division` of a
 * name he prints as one (decision 10). `undefined` for a name with no 1533
 * reading, which is Shelachel alone. Another witness's spelling with a
 * different trace is that reading's `he`.
 */
function tracedSpelling(name: PlanetaryName): string | undefined {
  return name.division ?? name.witnesses.agrippa1533?.he;
}

export type {
  PlanetaryName,
  PlanetaryNameCount,
  PlanetaryNameId,
  PlanetaryNameReading,
  PlanetaryNames,
  PlanetaryNameWitness,
};
export { PLANETARY_NAME_WITNESSES, readingOf, tracedSpelling };
export default rows;
