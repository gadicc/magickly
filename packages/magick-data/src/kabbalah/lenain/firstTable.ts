import witnesses from "../../../dist/kabbalah/lenain/witnesses.js";
import angels from "../SeventyTwoAngels.ts";
import { leaves } from "./volume.ts";

/**
 * The first cabalistic table, whole again.
 *
 * It is a fold-out leaf, and both copies scanned were photographed folded. The
 * reissue this edition transcribes (recorded as 1909) shows rows 62 to 72; the
 * 1823 printing (Google Books qt9SAAAAcAAJ, page 25) was opened further and
 * shows 57 to 72, the fifty-seventh cut through by the fold. Rows 1 to 56 are
 * on no image of Lenain's plate found. (Kircher's plate of the seventy-two
 * names of God by nation, very likely the source of the last two columns, is
 * in one archive.org copy, partly folded and not yet transcribed: plan 033.)
 * Every column the table carries — the genius, the nation, that nation's name
 * for God — is also given in the genius's own entry, so nothing it held is
 * lost, only its arrangement. This puts the arrangement back.
 *
 * It is derived and never stored in `pages.json5`. That file is what the page
 * prints, and a reconstruction written into it would be indistinguishable from
 * a reading a year from now — which is the one thing an edition whose whole
 * argument is "here is the evidence" cannot afford. Rows on the reissue's
 * plate come from the transcription, rows only the 1823 plate shows from
 * `witnesses.json5`, and the rest are marked as reconstructed wherever they
 * are shown; the apparatus carries the note explaining why. See plan 033.
 */

/** Where a row comes from, in the order one is preferred to another. */
export type FirstTableSource = "plate1909" | "plate1823" | "reconstructed";

/** What each source is called wherever a row is labelled. */
export const SOURCE_LABEL: Record<FirstTableSource, string> = {
  plate1909: "on the reissue's plate",
  plate1823: "on the 1823 plate",
  reconstructed: "reconstructed",
};

export interface FirstTableRow {
  no: number;
  /** The genius, as the entries romanise it. */
  name: string;
  /** The nation, in Lenain's own French. */
  nation: string;
  /** That nation's name for God, set in capitals as the table sets them. */
  godName: string;
  /** Which plate shows this row, or that it is put back from the entries. */
  source: FirstTableSource;
  /** A row the fold cuts through, legible only in part. */
  partly?: boolean;
}

interface PlateRow {
  no: number;
  name: string;
  nation: string;
  godName: string;
  partly?: boolean;
}

/**
 * Lenain's table sets the nation as a plain noun phrase — "Les Carmaniens" —
 * where an entry may say « les anciens Carmaniens » or name a language. The
 * entry's own French is used as it stands rather than edited towards the
 * table's wording, since guessing at his phrasing is the opposite of the
 * point.
 */
function nationOf(fr: string) {
  if (!fr) return "";
  return fr.charAt(0).toUpperCase() + fr.slice(1);
}

/** Leader dots and the closing stop are typography, not the reading. */
function cell(text: string) {
  return text
    .replace(/[\s.·]+$/g, "")
    .replace(/\s*\.\s*/g, " ")
    .trim();
}

/**
 * The rows still on the reissue's plate, as the plate sets them.
 *
 * A row marked "on the plate" must show what the plate shows, or the label
 * claims a provenance the value has not got: Lenain's table reads "Les
 * Carmaniens" and "Mogols" where his entries read "les anciens Carmaniens"
 * and "Mongols", and showing the entry's wording under his table's name would
 * put words in it. The sixty-second's name is blank there, and stays blank.
 */
function plate1909(): Map<number, PlateRow> {
  const rows = new Map<number, PlateRow>();
  for (const leaf of leaves) {
    if (leaf.page.anchor !== "p25") continue;
    for (const block of leaf.blocks) {
      if (block.kind !== "table") continue;
      for (const row of block.rows) {
        const no = Number(row[0]?.replace(/\D/g, ""));
        if (no >= 1 && no <= 72)
          rows.set(no, {
            no,
            name: cell(row[1] ?? ""),
            nation: cell(row[2] ?? ""),
            godName: cell(row[3] ?? ""),
          });
      }
    }
  }
  return rows;
}

/** The rows on the 1823 printing's plate, as read by hand. */
function plate1823(): Map<number, PlateRow> {
  const { rows } = (witnesses as { firstTable: { rows: PlateRow[] } })
    .firstTable;
  return new Map(
    rows.map((row) => [
      row.no,
      {
        no: row.no,
        name: cell(row.name),
        nation: cell(row.nation),
        godName: cell(row.godName),
        ...(row.partly ? { partly: true } : {}),
      },
    ]),
  );
}

/** A row as the entries give it, for where no plate shows one. */
function fromEntries(no: number): PlateRow {
  const angel = angels[no - 1];
  return {
    no,
    name: angel.name.en,
    nation: nationOf(angel.people.fr),
    godName: angel.godName.toUpperCase(),
  };
}

/**
 * Every row, from the reissue's plate where it shows one, the 1823 plate
 * where only that does, and the entries elsewhere. Rows 62 to 72 stay the
 * reissue's, as the edition transcribes it; where the 1823 plate differs
 * there, `plateDifferences` says so.
 */
export function firstTable(): FirstTableRow[] {
  const reissue = plate1909();
  const original = plate1823();
  return angels.map((angel) => {
    const on1909 = reissue.get(angel.no);
    if (on1909) return { ...on1909, source: "plate1909" as const };
    const on1823 = original.get(angel.no);
    if (on1823) return { ...on1823, source: "plate1823" as const };
    return { ...fromEntries(angel.no), source: "reconstructed" as const };
  });
}

/** How many rows each source gives. */
export function firstTableCounts(): Record<FirstTableSource, number> {
  const counts = { plate1909: 0, plate1823: 0, reconstructed: 0 };
  for (const row of firstTable()) counts[row.source]++;
  return counts;
}

/** The first and last row a plate shows, for "rows 57 to 72". */
export function plateRange(plate: "plate1909" | "plate1823"): {
  from: number;
  to: number;
  partly: number[];
} {
  const rows = [...(plate === "plate1909" ? plate1909() : plate1823())];
  const numbers = rows.map(([no]) => no);
  return {
    from: Math.min(...numbers),
    to: Math.max(...numbers),
    partly: rows.filter(([, row]) => row.partly).map(([no]) => no),
  };
}

const COLUMNS = ["name", "nation", "godName"] as const;
export type FirstTableColumn = (typeof COLUMNS)[number];

/** Two cells are the same reading when only their case differs. */
const same = (a: string, b: string) =>
  a.toLocaleLowerCase("fr") === b.toLocaleLowerCase("fr");

/**
 * How well the entries recover each plate: of the rows a plate shows in full,
 * how many the method would have put back exactly, column by column. A row the
 * fold cuts through is left out, since a miss there may be the fold's. A miss
 * is a place where Lenain's table and his entry disagree, or where the plate's
 * cell is blank.
 */
export function firstTableAgreement(): Record<
  "plate1909" | "plate1823",
  { rows: number } & Record<FirstTableColumn, number>
> {
  const tally = (plate: Map<number, PlateRow>) => {
    const whole = [...plate.values()].filter((row) => !row.partly);
    const result = { rows: whole.length, name: 0, nation: 0, godName: 0 };
    for (const row of whole) {
      const put = fromEntries(row.no);
      for (const column of COLUMNS)
        if (same(row[column], put[column])) result[column]++;
    }
    return result;
  };
  return { plate1909: tally(plate1909()), plate1823: tally(plate1823()) };
}

export interface PlateDifference {
  no: number;
  column: FirstTableColumn;
  /** Empty where the plate leaves the cell blank or cannot be read. */
  plate1909: string;
  plate1823: string;
}

/** Where both plates show a row and do not agree on it. */
export function plateDifferences(): PlateDifference[] {
  const reissue = plate1909();
  const differences: PlateDifference[] = [];
  for (const [no, original] of plate1823()) {
    const later = reissue.get(no);
    if (!later) continue;
    for (const column of COLUMNS)
      if (!same(later[column], original[column]))
        differences.push({
          no,
          column,
          plate1909: later[column],
          plate1823: original[column],
        });
  }
  return differences;
}

/** What a column is called in a sentence. */
export const COLUMN_NAME: Record<FirstTableColumn, string> = {
  name: "name",
  nation: "nation",
  godName: "name of God",
};

/** "row 57" or "rows 57 and 58". */
function rowsNamed(numbers: number[]) {
  return `row${numbers.length > 1 ? "s" : ""} ${numbers.join(" and ")}`;
}

/**
 * One difference between the plates, as a clause: "row 62's name is blank on
 * the reissue's plate and “Iahhel” on the 1823". Shared by the page and the
 * Markdown, as are the sentences below, so the two cannot say different
 * things, and every number in them is counted from the rows.
 */
export function describeDifference(difference: PlateDifference): string {
  const shown = (value: string) => (value ? `“${value}”` : "blank");
  return (
    `row ${difference.no}'s ${COLUMN_NAME[difference.column]} is ` +
    `${shown(difference.plate1909)} on the reissue's plate and ` +
    `${shown(difference.plate1823)} on the 1823`
  );
}

/**
 * How often the entries recover one column, on both plates, as a clause:
 * "all 11 on the reissue's plate and 14 of the 15 on the 1823".
 */
export function recoveredClause(column: FirstTableColumn): string {
  const agreement = firstTableAgreement();
  const of = (plate: { rows: number } & Record<FirstTableColumn, number>) =>
    plate[column] === plate.rows
      ? `all ${plate.rows}`
      : `${plate[column]} of the ${plate.rows}`;
  return (
    `${of(agreement.plate1909)} on the reissue's plate and ` +
    `${of(agreement.plate1823)} on the 1823`
  );
}

/** ", row 57 only in part", or nothing where the plate shows every row whole. */
export function partlyClause(): string {
  const { partly } = plateRange("plate1823");
  return partly.length ? `, ${rowsNamed(partly)} only in part` : "";
}

/** How well the method recovers the plates, and why it misses. */
export function checkedSentence(): string {
  const { partly } = plateRange("plate1823");
  const leftOut = partly.length
    ? ` (${rowsNamed(partly)}, only partly legible, left out)`
    : "";
  return (
    `Checked against the rows the plates show in full${leftOut}, the method ` +
    `recovers the name of God for ${recoveredClause("godName")}, the nation ` +
    `for ${recoveredClause("nation")}, and the genius's name for ` +
    `${recoveredClause("name")}. The misses are places where Lenain's table ` +
    `and his entries spell or word a name or a nation differently — “Les ` +
    `Carmaniens” in the table, “les anciens Carmaniens” in the entry — or ` +
    `where the plate leaves a cell blank.`
  );
}

/** Where the two plates differ, or nothing where they agree throughout. */
export function differencesSentence(): string {
  const differences = plateDifferences();
  if (!differences.length) return "";
  return (
    `Where both plates show a row, they differ ${differences.length} ` +
    `time${differences.length > 1 ? "s" : ""}: ` +
    `${differences.map(describeDifference).join("; ")}. Those rows are given ` +
    `here as the reissue's plate has them, since that is the copy this ` +
    `edition transcribes.`
  );
}
