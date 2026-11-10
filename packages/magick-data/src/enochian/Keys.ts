import parsed from "../../dist/enochian/keys.js";
import tabletNotes, { type TabletWork } from "./TabletNotes.ts";

/**
 * The Enochian Keys (plan 073), one row per word as Dee received it, from
 * `keys.json5`. A row holds each work's reading of the word (`readings`),
 * and a version is a rule over them (`keyVersion`), as the tablets have
 * it: Dee's (`dee`, the default, since the English is Dee's) and the
 * Golden Dawn's (`gd`). Key 19, the Call of the Thirty Aethyrs, marks the
 * rows that change with the Aethyr as slots, and `aethyrCall` fills them.
 * Each Key says what was checked against what (`checked`), for the page
 * and the README to read rather than restate.
 */

/**
 * The works the Keys cite. All but `legacy2023` are in the registry
 * `magick-data/enochian/tabletNotes` keeps; `legacy2023` is the text the
 * Keys had from 2023, whose source is not known, and goes once every Key
 * is re-derived.
 */
export type KeyWorkId =
  | "casaubon1659"
  | "equinox1912no8"
  | "equinox1911no5"
  | "sloane3191"
  | "legacy2023";

/** What a source was read for: Dee's word, its English, the GD's form. */
export type KeyField = "enochian" | "english" | "gd";

/** A place in a work: a printed page and the scan's leaf. */
export interface KeySource {
  work: KeyWorkId;
  page?: number;
  leaf?: number;
  /** What was read there, when it is not everything the row holds. */
  field?: KeyField;
}

/** What Casaubon prints for one of Dee's words. */
export interface CasaubonReading {
  /** Dee's word, forward, in capitals: what the dictionary is searched by. */
  word: string;
  /** The word as dictated, where that differs (Keys 1 to 4, backwards). */
  dictated?: string;
  /** Casaubon's pronunciation column, as printed, accents and all. */
  pronunciation?: string;
  /** The capitals as printed where they differ from `word`: damage, a stray mark. */
  printed?: string;
}

/**
 * How a Golden Dawn form stands to Dee's words: `joined`, part of the
 * form on an earlier row; `split`, one Dee word printed as several;
 * `absent`, left out; `overlap`, sharing sounds with the word before it
 * ("das iod" for DSI OD), whose row has the form.
 */
export type GdMarker = "joined" | "split" | "absent" | "overlap";

/** The Golden Dawn's form for one of Dee's words (Equinox I(8)). */
export interface GdReading {
  word?: string;
  marker?: GdMarker;
}

/** A word of the 2023 text, for a Key not yet re-derived. */
export interface LegacyReading {
  word: string;
}

/** Each work's reading of a word. */
export interface KeyReadings {
  casaubon1659?: CasaubonReading;
  equinox1912no8?: GdReading;
  sloane3191?: { word: string };
  legacy2023?: LegacyReading;
}

/** A row of Key 19 that changes with the Aethyr. */
export type KeySlot = "aethyr" | "idoigo";

/** One of Dee's words, and its English. */
export interface KeyRow {
  /**
   * Dee's English for the word, as Casaubon prints it. On Key 19 it may
   * hold `{ordinal}`, the Aethyr's ordinal ("first").
   */
  english: string;
  /** The English was split from running text by us (plan 073, decision 4). */
  englishSplit?: true;
  readings: KeyReadings;
  /** Crowley's English, where it differs in substance. */
  gdEnglish?: string;
  /** Where the row is printed. */
  sources?: readonly KeySource[];
  /** The reading is doubtful: a damaged print, a guessed letter. */
  uncertain?: true;
  /**
   * A word given but not spoken, so no source prints it: Key 1's two words
   * that Nalvage "hummed" (Casaubon p. 84). Its English and place are
   * ours, and its note says so.
   */
  unspoken?: true;
  /**
   * Casaubon's print lost the word (Keys 14 and 15, and 16's first twelve
   * words): the row has no `casaubon1659` reading, only the Equinox's
   * form, which Dee's version then shows as Crowley's (`from`). Its note
   * says so.
   */
  notInCasaubon?: true;
  /** What the 2023 text had, where this row corrects it. */
  was?: string;
  note?: string;
  /** A note on the Golden Dawn's form. */
  gdNote?: string;
  slot?: KeySlot;
}

/** What a Key was checked against, and what not (plan 073, decision 8). */
export interface KeyChecked {
  /** When, as YYYY-MM-DD; none for a Key not re-derived. */
  date?: string;
  works: readonly KeyWorkId[];
  covered: readonly KeyField[];
  /** What was not checked, in words. */
  notCovered: readonly string[];
}

/** One Key. */
export interface EnochianKey {
  key: number;
  /** Casaubon's number for the Call, in the order received (Key 18 is his 14). */
  casaubonCall?: number;
  /** The date it was dictated, as printed. */
  dictated?: string;
  note?: string;
  /** The works and pages the Key is read from. */
  sources: readonly KeySource[];
  checked: KeyChecked;
  rows: readonly KeyRow[];
}

/** The name of an Aethyr in each work that gives it. */
export interface AethyrReadings {
  /** The list after the Call, p. 209, as printed ("Lil"): Dee's spelling. */
  casaubon1659?: string;
  /** Crowley's table, The Equinox I(8), p. 125. */
  equinox1912no8: string;
  /** The chapter headings of "The Vision and the Voice", The Equinox I(5). */
  equinox1911no5?: string;
  /** Dee's own copy, when its images can be read again. */
  sloane3191?: string;
}

/** One of the thirty Aethyrs. */
export interface Aethyr {
  /** 1 (LIL) to 30 (TEX). */
  n: number;
  readings: AethyrReadings;
  note?: string;
  sources: readonly KeySource[];
}

/** What `keys.json5` holds. */
export interface KeysData {
  keys: readonly EnochianKey[];
  aethyrs: readonly Aethyr[];
}

/** Freezes a value and everything in it. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const each of Object.values(value)) deepFreeze(each);
  }
  return value;
}

const data: KeysData = deepFreeze(parsed as KeysData);

/** The Keys there are, in order. */
const keys: readonly EnochianKey[] = data.keys;

/** The thirty Aethyrs, or none while Key 19 is not in the data. */
export const aethyrs: readonly Aethyr[] = data.aethyrs;

/** The versions, each a rule over the readings (`keyVersion`). */
export const KEY_VERSIONS: readonly ["dee", "gd"] = Object.freeze([
  "dee",
  "gd",
] as const);

/** A version of the Keys. */
export type KeyVersionId = (typeof KEY_VERSIONS)[number];

/** Dee's, since the English is his. */
export const DEFAULT_KEY_VERSION: KeyVersionId = "dee";

/** One version's rule. */
export interface KeyVersionRule {
  /** The readings a word is taken from: the first one a row has. */
  readings: readonly (keyof KeyReadings)[];
}

/**
 * Each version as a rule. `dee` takes Dee's own copy when it can be read,
 * then Casaubon's print, then the 2023 text, and last the Equinox's form,
 * for a word Casaubon's print lost; `gd` the Equinox's form. Both give
 * Dee's English (plan 073, decision 3), and a word is always looked up by
 * Dee's spelling, or by Crowley's form where that is all there is.
 */
export const KEY_VERSION_RULES: Readonly<Record<KeyVersionId, KeyVersionRule>> =
  deepFreeze({
    dee: {
      readings: ["sloane3191", "casaubon1659", "legacy2023", "equinox1912no8"],
    },
    gd: { readings: ["equinox1912no8"] },
  });

/** A Key's word in a version. */
export interface KeyWord {
  /** Its row, from 1. Rows renumber freely; nothing should keep these. */
  row: number;
  /** The word, or `null`: joined to an earlier one, absent, or not read. */
  word: string | null;
  marker?: GdMarker;
  /** Dee's word, which the dictionary is searched by, whatever the version. */
  lookup: string | null;
  english: string;
  /** The work `word` comes from, where it is not the version's own. */
  from?: KeyWorkId;
  uncertain?: true;
  /** Given but not spoken, so no word is printed (`KeyRow.unspoken`). */
  unspoken?: true;
  note?: string;
  slot?: KeySlot;
}

const UNITS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
];

/** The English ordinals of the thirty Aethyrs, for Key 19's English. */
export const AETHYR_ORDINALS: readonly string[] = Object.freeze([
  ...UNITS,
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
  ...UNITS.map((unit) => `twenty-${unit}`),
  "thirtieth",
]);

/**
 * A Golden Dawn form as a word to look up: in capitals, without the
 * hyphens and spaces Crowley prints to show its sounding.
 */
function lookupOf(form: string): string {
  // Letters only: Crowley's hyphens, spaces, apostrophes ("bial'") and
  // accents ("monasaçi") are reading aids, not letters of the word.
  return form
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

/** Dee's word for a row: the first reading the `dee` rule finds. */
function deeWord(
  row: KeyRow,
): { word: string; lookup: string; from?: KeyWorkId } | undefined {
  for (const work of KEY_VERSION_RULES.dee.readings) {
    const word = row.readings[work]?.word;
    if (!word) continue;
    // Crowley's form stands in only for a word Casaubon's print lost.
    return work === "equinox1912no8"
      ? { word, lookup: lookupOf(word), from: work }
      : { word, lookup: word };
  }
  return undefined;
}

/** A Key, by its number. */
export function keyByNumber(n: number): EnochianKey | undefined {
  return keys.find((key) => key.key === n);
}

/**
 * Whether a Key has a reading in a version. Every Key has Dee's, since its
 * rows are his words, even where the 2023 text gives only their English.
 * A Key has the Golden Dawn's when a row Casaubon prints has the
 * Equinox's form: the forms that stand in for words his print lost do not
 * make a version on their own.
 */
export function hasVersion(key: EnochianKey, version: string): boolean {
  if (!(KEY_VERSIONS as readonly string[]).includes(version)) return false;
  if (version === "dee") return true;
  const rule = KEY_VERSION_RULES[version as KeyVersionId];
  return key.rows.some(
    (row) =>
      !row.notInCasaubon &&
      rule.readings.some((work) => row.readings[work] !== undefined),
  );
}

/** Whether any of the given Keys has the Golden Dawn's reading. */
export function hasGdReadings(from: readonly EnochianKey[] = keys): boolean {
  return from.some((key) => hasVersion(key, "gd"));
}

/**
 * A Key's words in a version, or `undefined` for a version it has no
 * reading in, or one not in `KEY_VERSIONS`. The rules:
 *
 * - **`dee`**: the first of Sloane MS 3191, Casaubon and the 2023 text
 *   the row has, or for a word Casaubon's print lost the Equinox's form,
 *   with `from` and looked up without its hyphens and spaces.
 * - **`gd`**: the Equinox's form; `null` where Crowley joins the word to
 *   an earlier one, leaves it out or overlaps it, with the `marker`.
 *
 * Both give Dee's English, and the Golden Dawn's notes in `gd`. On Key 19
 * the Aethyr's slot takes its name (1 to 30, LIL by default): Dee's
 * spelling in `dee` (Sloane MS 3191's, else Casaubon's list, in capitals
 * as Dee's words are; Crowley's with `from` where neither has it), the
 * Equinox's in `gd`; and `{ordinal}` in the English becomes the Aethyr's.
 * IDOIGO's slot is marked but stays as it is: Crowley says the name may
 * be varied with the Aethyr and gives no word to vary it to. `table` is
 * the Aethyrs to take the names from.
 */
export function keyVersion(
  key: EnochianKey,
  version: string = DEFAULT_KEY_VERSION,
  aethyr = 1,
  table: readonly Aethyr[] = aethyrs,
): readonly KeyWord[] | undefined {
  if (!hasVersion(key, version)) return undefined;
  const id = version as KeyVersionId;
  const theAethyr = table.find((one) => one.n === aethyr);
  const ordinal = AETHYR_ORDINALS[aethyr - 1] ?? "";
  return key.rows.map((row, index) => {
    const dee = deeWord(row);
    const out: KeyWord = {
      row: index + 1,
      word: dee?.word ?? null,
      lookup: dee?.lookup ?? null,
      english: row.english.replaceAll("{ordinal}", ordinal),
    };
    if (id === "dee" && dee?.from) out.from = dee.from;
    if (id === "gd") {
      const gd = row.readings.equinox1912no8;
      const shown = !gd?.marker || gd.marker === "split";
      out.word = shown ? (gd?.word ?? null) : null;
      if (gd?.marker) out.marker = gd.marker;
    }
    if (row.uncertain) out.uncertain = true;
    if (row.unspoken) out.unspoken = true;
    const note = id === "gd" && row.gdNote ? row.gdNote : row.note;
    if (note) out.note = note;
    if (row.slot) {
      out.slot = row.slot;
      if (theAethyr) substitute(out, row.slot, id, theAethyr);
    }
    return out;
  });
}

/**
 * Fills Key 19's Aethyr slot, in place; IDOIGO's has nothing to fill.
 *
 * In the Golden Dawn's version a slot whose row Crowley joins to an
 * earlier word, leaves out or runs into the one before keeps that: it
 * shows no word and keeps its marker, and only its lookup takes the
 * Aethyr's. A shown slot takes the name as one word, so a `split` marker,
 * which described the first Aethyr's form, is dropped.
 */
function substitute(
  word: KeyWord,
  slot: KeySlot,
  version: KeyVersionId,
  aethyr: Aethyr,
) {
  if (slot !== "aethyr") return;
  const { readings } = aethyr;
  const dee = readings.sloane3191 ?? readings.casaubon1659;
  // Looked up by Dee's spelling in either version, as every word is.
  const lookup = (dee ?? readings.equinox1912no8).toUpperCase();
  if (version === "dee") {
    // The row is Dee's word for the first Aethyr.
    if (aethyr.n === 1 && word.word && !word.from) return;
    word.word = lookup;
    word.lookup = lookup;
    if (dee) delete word.from;
    else word.from = "equinox1912no8";
    return;
  }
  word.lookup = lookup;
  if (word.marker && word.marker !== "split") return;
  word.word = readings.equinox1912no8;
  delete word.marker;
}

/**
 * The Call of Aethyr n (1 to 30) in a version: Key 19 with its slots
 * filled, or `undefined` without Key 19 or for no such Aethyr.
 */
export function aethyrCall(
  n: number,
  version: string = DEFAULT_KEY_VERSION,
): readonly KeyWord[] | undefined {
  const key = keyByNumber(19);
  if (!key || !aethyrs.some((aethyr) => aethyr.n === n)) return undefined;
  return keyVersion(key, version, n);
}

/** A Key's title: "Key 4", and Key 19 by what it is. */
export function keyTitle(key: EnochianKey): string {
  return key.key === 19
    ? "Key 19: the Call of the Thirty Aethyrs"
    : `Key ${key.key}`;
}

/** The 2023 text, which is in no registry: it has no source to cite. */
const LEGACY_WORK: TabletWork = {
  title: "The 2023 text of the Keys, whose source is not known",
  year: 2023,
};

/** A work the Keys cite, from the registry the tablets' notes keep. */
export function keyWork(id: KeyWorkId): TabletWork {
  return id === "legacy2023" ? LEGACY_WORK : tabletNotes.works[id];
}

/** Short names for the works, for a line of text. */
const SHORT_NAMES: Readonly<Record<KeyWorkId, string>> = {
  casaubon1659: "Casaubon's print of Dee's journal (1659)",
  equinox1912no8: "The Equinox I(8) (1912)",
  equinox1911no5: "The Equinox I(5) (1911)",
  sloane3191: "Dee's own copy, Sloane MS 3191",
  legacy2023: "the 2023 text",
};

const FIELD_NAMES: Readonly<Record<KeyField, string>> = {
  enochian: "the Enochian",
  english: "the English",
  gd: "the Golden Dawn's reading",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "a, b and c". */
function list(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** A YYYY-MM-DD date as "10 November 2026". */
function longDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * What a Key's check covered, as a sentence or two for the page:
 * "Checked on 10 November 2026 against Casaubon's print of Dee's journal
 * (1659): the Enochian and the English. Not checked: …".
 */
export function checkedText(checked: KeyChecked): string {
  const not = checked.notCovered.length
    ? ` Not checked: ${list(checked.notCovered)}.`
    : "";
  if (!checked.works.length || !checked.covered.length)
    return `Not yet checked.${not}`;
  const when = checked.date ? ` on ${longDate(checked.date)}` : "";
  const works = list(checked.works.map((work) => SHORT_NAMES[work]));
  const fields = list(checked.covered.map((field) => FIELD_NAMES[field]));
  return `Checked${when} against ${works}: ${fields}.${not}`;
}

/** A source as a line of text: "Meric Casaubon … p.109 (archive.org leaf n198)". */
export function keySourceText(source: KeySource): string {
  const work = keyWork(source.work);
  const page = source.page ? `, p.${source.page}` : "";
  const leaf = source.leaf ? ` (archive.org leaf n${source.leaf})` : "";
  return `${work.title}${page}${leaf}`;
}

export default keys;
