import notes from "../../dist/enochian/tabletNotes.js";
import type { TabletNameId, TabletNameKind } from "./TabletNames.ts";
import type {
  EnochianTabletID,
  EnochianWatchtowerID,
  TabletVersionId,
} from "./Tablets.ts";

/**
 * Notes on the Enochian tablets (plan 061, "Tablet versions"): the
 * versions, how each differs from the others, each tablet, and particular
 * squares. The prose is ours; the works are cited by stable reference.
 * What a source prints in a square, and where two versions differ, are
 * read from the readings in `magick-data/enochian/tablets`, never written
 * here. Squares are counted from 0, as the readings count them.
 */

/**
 * The works the notes cite, and the Keys too (`magick-data/enochian/keys`):
 * one registry, so that no work is cited two ways. `equinox1912` is I(7),
 * the tablets' issue; the Keys are in I(8), an id of its own.
 */
export type TabletWorkId =
  | "sloane3191"
  | "cottonAppXLVI"
  | "casaubon1659"
  | "equinox1912"
  | "equinox1911no5"
  | "equinox1912no8"
  | "regardie1937"
  | "regardie1939"
  | "regardie1940"
  | "greer";

/** A cited work: its title, and where a public scan or the edition is found. */
export interface TabletWork {
  title: string;
  year?: number;
  isbn?: string;
  /** An archive.org item, and the file within it where it holds several. */
  archive?: { item: string; file?: string };
}

/** A place in a work: a part, a printed page or plate, and the scan's leaf. */
export interface TabletSource {
  work: TabletWorkId;
  /** A part with a pagination of its own ("Actio Tertia"). */
  part?: string;
  page?: number;
  plate?: string;
  leaf?: number;
}

/** A titled paragraph: a way the versions differ. */
export interface TabletTopic {
  id: string;
  title: string;
  text: string;
  sources: readonly TabletSource[];
}

/** One version: where it comes from, and how it differs from each other. */
export interface TabletVersionNote {
  id: TabletVersionId;
  title: string;
  text: string;
  sources: readonly TabletSource[];
  /** Which letters it reverses, and why. */
  reversed: string;
  /** Which sigils it draws, or why none. */
  sigils: string;
  /**
   * How it differs from each other version, in words; the squares and
   * counts are the readings' (`tabletDifferences`).
   */
  differs: Readonly<Partial<Record<TabletVersionId, string>>>;
}

/** One tablet's note. */
export interface TabletNote {
  text: string;
  sources: readonly TabletSource[];
}

/** A note on one square. */
export interface SquareNote {
  row: number;
  column: number;
  note: string;
  sources: readonly TabletSource[];
}

/**
 * Where a kind of name is read (`magick-data/enochian/tabletNames`), as one
 * tradition gives it: the Golden Dawn's for its versions, Dee's record for
 * Dee's and Raphael's.
 */
export interface TabletNameRule {
  kinds: readonly TabletNameKind[];
  versions: readonly TabletVersionId[];
  text: string;
  sources: readonly TabletSource[];
}

/** Where the Golden Dawn's attributions of the names come from. */
export interface TabletNameAttributionNote {
  attribution: "element" | "planet";
  text: string;
  sources: readonly TabletSource[];
}

/**
 * Why no path gives a cited spelling: it reads both letters of a doubled
 * square (`doubledSquare`, the square or squares in `squares`), or a
 * square's second letters (`secondLetters`), or the source spells the name
 * otherwise (`spelling`), or puts another letter of the Tablet of Union in
 * front (`prefix`).
 */
export type CitedSpellingReason =
  | "doubledSquare"
  | "secondLetters"
  | "spelling"
  | "prefix";

/** A spelling a source prints for a name that no version's path gives. */
export interface CitedTabletSpelling {
  tablet: EnochianWatchtowerID;
  id: TabletNameId;
  spelling: string;
  reason: CitedSpellingReason;
  /**
   * The letter of the Tablet of Union before the name, for a Kerubic
   * archangel's spelling (`<quarter>-kerubic-archangel`).
   */
  prefix?: string;
  /** The doubled squares read with both letters, by row and column from 0. */
  squares?: readonly { row: number; column: number }[];
  text: string;
  sources: readonly TabletSource[];
}

/** A spelling the dictionary gives a name that no source or rule gives. */
export interface DictionaryTabletSpelling {
  tablet: EnochianWatchtowerID;
  id: TabletNameId;
  spelling: string;
}

/**
 * The dictionary's own spellings of the Kerubic archangels, with another
 * letter of the Tablet of Union before the Kerubic name than the Golden
 * Dawn's rule gives (plan 090, decision 8): what they are, in `text`, and
 * each one on its name.
 */
export interface DictionaryTabletSpellings {
  text: string;
  spellings: readonly DictionaryTabletSpelling[];
}

/** The notes on the names read off the tablets. */
export interface TabletNamesNotes {
  rules: readonly TabletNameRule[];
  attributions: readonly TabletNameAttributionNote[];
  cited: readonly CitedTabletSpelling[];
  dictionary: DictionaryTabletSpellings;
}

/**
 * What a rule of the pyramids covers (`magick-data/enochian/tabletPyramids`):
 * the sides in general, a region of the tablets, or the gods of the
 * servient squares.
 */
export type TabletPyramidTopic =
  | "sides"
  | "greatCross"
  | "calvaryCross"
  | "kerubic"
  | "servient"
  | "union"
  | "gods";

/** A rule of the pyramids as one witness gives it, in our words. */
export interface TabletPyramidRule {
  topic: TabletPyramidTopic;
  /** The witness: vol. 4 (`regardie1940`) or the Equinox (`equinox1912`). */
  witness: TabletWorkId;
  text: string;
  sources: readonly TabletSource[];
}

/**
 * A place where a witness departs from the pyramids' rules, and whose slip
 * or change it is: the squares, by tablet and by row and column from 0,
 * and the side, 1 to 4.
 */
export interface TabletPyramidException {
  id: string;
  witness: TabletWorkId;
  /**
   * The versions in which it departs, where not all: vol. 4's worked
   * square that fits the Equinox's Calvary bar departs only from the
   * versions that follow vol. 4's.
   */
  versions?: readonly TabletVersionId[];
  squares: readonly {
    tablet: EnochianTabletID;
    row: number;
    column: number;
  }[];
  side: 1 | 2 | 3 | 4;
  text: string;
  sources: readonly TabletSource[];
}

/**
 * A reading of the pyramids that is ours, or a dispute we settle per
 * version: the Calvary bar, the sphinx, its tendency, the Children of
 * Horus, Earth as Saturn, the geomantic figures.
 */
export interface TabletPyramidReading {
  id: string;
  text: string;
  sources: readonly TabletSource[];
}

/** The notes on the pyramids (plan 095). */
export interface TabletPyramidNotes {
  rules: readonly TabletPyramidRule[];
  exceptions: readonly TabletPyramidException[];
  readings: readonly TabletPyramidReading[];
}

/** Everything the notes hold. */
export interface TabletNotes {
  works: Readonly<Record<TabletWorkId, TabletWork>>;
  /** Why there are versions, for a page that offers them. */
  intro: string;
  versions: readonly TabletVersionNote[];
  differences: readonly TabletTopic[];
  tablets: Readonly<Record<EnochianTabletID, TabletNote>>;
  names: TabletNamesNotes;
  pyramids: TabletPyramidNotes;
  squares: Readonly<Partial<Record<EnochianTabletID, readonly SquareNote[]>>>;
}

const tabletNotes: TabletNotes = notes as TabletNotes;

/** A version's note, or nothing for an id that is not a version. */
export function versionNote(id: string): TabletVersionNote | undefined {
  return tabletNotes.versions.find((version) => version.id === id);
}

/** The notes on one tablet's squares, top row first; none for a key without. */
export function squareNotes(id: string): readonly SquareNote[] {
  return Object.hasOwn(tabletNotes.squares, id)
    ? (tabletNotes.squares[id as EnochianTabletID] as readonly SquareNote[])
    : [];
}

/** The note on one square, by row and column from 0, if it has one. */
export function squareNote(
  id: string,
  row: number,
  column: number,
): SquareNote | undefined {
  return squareNotes(id).find(
    (note) => note.row === row && note.column === column,
  );
}

/**
 * Where a kind of name is read in a version: the rules that say so, with
 * their sources. None for a kind or version the notes do not have.
 */
export function nameRules(
  kind: string,
  version: string,
): readonly TabletNameRule[] {
  return tabletNotes.names.rules.filter(
    (rule) =>
      (rule.kinds as readonly string[]).includes(kind) &&
      (rule.versions as readonly string[]).includes(version),
  );
}

/** Where one of the Golden Dawn's attributions comes from. */
export function attributionNote(
  attribution: string,
): TabletNameAttributionNote | undefined {
  return tabletNotes.names.attributions.find(
    (note) => note.attribution === attribution,
  );
}

/**
 * The spellings sources print for one name of one tablet that no
 * version's path gives, each with its source.
 */
export function citedSpellings(
  tablet: string,
  id: string,
): readonly CitedTabletSpelling[] {
  return tabletNotes.names.cited.filter(
    (cited) => cited.tablet === tablet && cited.id === id,
  );
}

/**
 * The dictionary's own spellings of one name of one tablet, which no
 * source or rule gives (`names.dictionary`): shown as the dictionary's.
 */
export function dictionarySpellings(
  tablet: string,
  id: string,
): readonly DictionaryTabletSpelling[] {
  return tabletNotes.names.dictionary.spellings.filter(
    (each) => each.tablet === tablet && each.id === id,
  );
}

/**
 * The rules of the pyramids on one topic, each witness's, vol. 4's first.
 * None for a topic the notes do not have.
 */
export function pyramidRules(topic: string): readonly TabletPyramidRule[] {
  return tabletNotes.pyramids.rules.filter((rule) => rule.topic === topic);
}

/**
 * The places where a witness departs from the pyramids' rules on one
 * tablet, or on any with none given.
 */
export function pyramidExceptions(
  tablet?: string,
): readonly TabletPyramidException[] {
  return tabletNotes.pyramids.exceptions.filter(
    (exception) =>
      tablet === undefined ||
      exception.squares.some((square) => square.tablet === tablet),
  );
}

/** One of our readings of the pyramids, by id. */
export function pyramidReading(id: string): TabletPyramidReading | undefined {
  return tabletNotes.pyramids.readings.find((reading) => reading.id === id);
}

/** A source as a line of text: "Regardie 1940 … p.271 (archive.org leaf n263)". */
export function sourceText(source: TabletSource): string {
  const work = tabletNotes.works[source.work];
  const place = [
    source.part ?? "",
    source.plate ? `Plate ${source.plate}` : "",
    source.page ? `p.${source.page}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const leaf = source.leaf ? ` (archive.org leaf n${source.leaf})` : "";
  const isbn = work.isbn ? `, ISBN ${work.isbn}` : "";
  return `${work.title}${isbn}${place ? `, ${place}` : ""}${leaf}`;
}

/** A link to a source's leaf in its archive.org scan, where there is one. */
export function sourceUrl(source: TabletSource): string | undefined {
  const archive = tabletNotes.works[source.work].archive;
  if (!archive) return undefined;
  const file = archive.file ? `/${encodeURIComponent(archive.file)}` : "";
  const leaf = source.leaf ? `/page/n${source.leaf}` : "";
  return `https://archive.org/details/${archive.item}${file}${leaf}`;
}

export default tabletNotes;
