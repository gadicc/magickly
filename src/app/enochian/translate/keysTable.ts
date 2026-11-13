import keys, {
  type Aethyr,
  aethyrs,
  type EnochianKey,
} from "magick-data/enochian/keys";

/**
 * The slim Keys table the translator reads in the browser (plan 081,
 * decision 19): per row only Casaubon's word, Crowley's form, Dee's
 * English and a few flags, against the 900 KB of `keys.json`, which
 * carries pronunciations, sources and notes the lookup never reads.
 * Built from `magick-data` on the server and served by `keys.json/route.ts`.
 */

/**
 * One row: Casaubon's word ("" where his print lost it), Crowley's form
 * ("" where he has none) and Dee's English, then `flags` when any apply:
 * `e` our split of Dee's running English (`englishSplit`); `j`, `o`,
 * `a`, `s` Crowley's marker (joined to an earlier form, overlapping it,
 * absent, or one word printed as several); `A` Key 19's Aethyr slot.
 */
export type KeysTableRow =
  | readonly [word: string, gd: string, english: string]
  | readonly [word: string, gd: string, english: string, flags: string];

/** The table: the Keys' rows by Key, and the Aethyrs' names. */
export interface KeysTable {
  /** Each Key's number and its rows, in order (row 1 first). */
  keys: readonly { key: number; rows: readonly KeysTableRow[] }[];
  /**
   * The thirty Aethyrs in order (1, LIL, first): Dee's spelling, then
   * Crowley's, for Key 19's slot.
   */
  aethyrs: readonly (readonly [dee: string, gd: string])[];
}

const MARKER_FLAGS = {
  joined: "j",
  overlap: "o",
  absent: "a",
  split: "s",
} as const;

/** The table from the Keys, as served. */
export function buildKeysTable(
  from: readonly EnochianKey[] = keys,
  table: readonly Aethyr[] = aethyrs,
): KeysTable {
  return {
    keys: from.map(({ key, rows }) => ({
      key,
      rows: rows.map((row): KeysTableRow => {
        const gd = row.readings.equinox1912no8;
        const flags =
          (row.englishSplit ? "e" : "") +
          (gd?.marker ? MARKER_FLAGS[gd.marker] : "") +
          (row.slot === "aethyr" ? "A" : "");
        const cells = [
          row.readings.casaubon1659?.word ?? "",
          gd?.word ?? "",
          row.english,
        ] as const;
        return flags ? [...cells, flags] : cells;
      }),
    })),
    aethyrs: table.map(({ readings }) => [
      (readings.sloane3191 ?? readings.casaubon1659 ?? "").toUpperCase(),
      readings.equinox1912no8,
    ]),
  };
}
