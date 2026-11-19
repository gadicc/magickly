import kircherPlate from "../../../dist/kabbalah/lenain/kircherPlate.js";
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
 * on no image of Lenain's plate found. Every column the table carries — the genius, the nation, that nation's name
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
 *
 * Beside every row stands its source: the ray of the same number on
 * Kircher's plate of the seventy-two names of God by nation (Oedipus
 * Aegyptiacus II.1, 1653, the plate after p. 287), which the nation and name
 * of God columns follow row for row (`kircherPlate.json5`).
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
  /** The same row on Kircher's plate, Lenain's source for the last two columns. */
  kircher: KircherRay;
  /** The columns in which Lenain's entry departs from Kircher's ray. */
  departs: ("nation" | "godName")[];
  /** What to say beside a nation the entry leaves empty, where there is more to say. */
  remark?: string;
}

/** One ray of Kircher's plate: a name of God and its nation, as engraved. */
export interface KircherRay {
  ray: number;
  /** In its own script, as engraved: יהרה, ΣΥΡΙ, DEVS. */
  godName: string;
  /** In Latin, as engraved: Hebræi, Abyſsini, Para.quaij. */
  nation: string;
  /** How sure the reading of the letters is, where it is not high. */
  confidence?: "medium" | "low";
  /** What the reader saw, where it is not plain. */
  note?: string;
  /** Said beside the row in the first table: ray 1's slip, ray 7's guess. */
  remark?: string;
}

/** A place where one of Lenain's entries departs from its ray. */
export interface KircherDeparture {
  no: number;
  /** The entry's field: its nation (`people`) or its name of God. */
  field: "people" | "godName";
  /** Who Kircher's nation are, in English. */
  gloss?: string;
  /** A likely cause, where the letters show one. */
  cause?: string;
  /** The entry alone departs: Lenain's table, on the plates, has Kircher's. */
  tableAgrees?: boolean;
}

/**
 * A ray whose nation an entry does not depart from: Kircher's Latin and the
 * entry's French, accepted by hand as the same people.
 */
export interface KircherNation {
  no: number;
  nation: string;
  entry: string;
}

/** An entry that names no nation but says whose the name is. */
export interface KircherRemark {
  no: number;
  /** The entry's own words that say it. */
  quote: string;
  /** What to say beside the row in the first table. */
  remark: string;
}

interface KircherFile {
  rays: KircherRay[];
  departures: KircherDeparture[];
  nations: KircherNation[];
  remarks: KircherRemark[];
}

const kircher = kircherPlate as KircherFile;

/** The plate's seventy-two rays, in order. */
export const kircherRays = (): KircherRay[] => kircher.rays;

/** Where Lenain's entries depart from the plate, as recorded by hand. */
export const kircherDepartures = (): KircherDeparture[] => kircher.departures;

/** The rows whose entry names no nation but says whose the name is. */
export const kircherRemarks = (): KircherRemark[] => kircher.remarks;

/** The nations accepted as the same people, one for every ray not departed from. */
export const kircherNations = (): KircherNation[] => kircher.nations;

/**
 * What the table says of a ray whose letters are not certain, or nothing:
 * the reader marked it medium or low.
 */
export const uncertainty = (ray: KircherRay): string =>
  ray.confidence ? "reading uncertain" : "";

const GREEK: Record<string, string> = {
  Α: "A",
  Β: "B",
  Γ: "G",
  Δ: "D",
  Ε: "E",
  Ɛ: "E",
  Η: "E",
  Θ: "TH",
  Ι: "I",
  Κ: "K",
  Λ: "L",
  Μ: "M",
  Ν: "N",
  Ο: "O",
  Π: "P",
  Ρ: "R",
  Σ: "S",
  Ϲ: "S",
  Τ: "T",
  Υ: "Y",
  Ω: "O",
};

/**
 * A name of God reduced to what transliteration leaves alone, so that two
 * spellings of one name compare equal: capitals without accents, Greek in
 * roman letters, V as U, Y as I, TH as T, and no letter doubled.
 * GOTT and Goth are both GOT; Θεὸς and Théos are both TEOS.
 */
export function transliterated(name: string): string {
  return [
    ...name
      .normalize("NFD")
      .replace(/\p{Mark}/gu, "")
      .toUpperCase(),
  ]
    .map((letter) => GREEK[letter] ?? letter)
    .join("")
    .replace(/V/g, "U")
    .replace(/Y/g, "I")
    .replace(/TH/g, "T")
    .replace(/(.)\1+/g, "$1");
}

/**
 * The rays whose name is in a script the rules above cannot read, with the
 * name as engraved and the name in Lenain's French that is the same name:
 * the Tetragrammaton (engraved with a resh for its vav: see the plate's note
 * on ray 1), Allah, and Thoth, whose four Greek letters Lenain's own
 * footnote counts. The engraved form is held to the plate's reading, so a
 * change to either fails rather than passing on the French alone.
 */
const SAME_NAME: Record<number, { engraved: string; french: string }> = {
  1: { engraved: "יהרה", french: "Jehovah" },
  4: { engraved: "الله", french: "Allah" },
  5: { engraved: "Θωντ", french: "Teut ou Theuth" },
};

/**
 * Whether Lenain's name of God is Kircher's for that ray, allowing for
 * transliteration. An alternative he adds with "ou" (Idio ou Iddio) passes
 * if any spelling does; a second name joined with "et" is a second name and
 * does not. An empty name is not Kircher's.
 */
export function sameGodName(lenain: string, ray: KircherRay): boolean {
  if (!lenain.trim()) return false;
  const same = SAME_NAME[ray.ray];
  if (same)
    return (
      ray.godName === same.engraved &&
      transliterated(lenain) === transliterated(same.french)
    );
  const engraved = transliterated(ray.godName);
  return lenain
    .split(/\s+ou\s+/)
    .some((spelling) => transliterated(spelling) === engraved);
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
  // The recorded departures are the entries'. A row put back from the
  // entries takes them as they are; so does a row a plate shows, whose cell
  // departs the same way, except a departure marked `tableAgrees`, where the
  // plates have Kircher's nation and only the entry does not.
  const departs = new Map<number, ("nation" | "godName")[]>();
  for (const { no, field, tableAgrees } of kircher.departures) {
    if (tableAgrees && (reissue.has(no) || original.has(no))) continue;
    departs.set(no, [
      ...(departs.get(no) ?? []),
      field === "people" ? "nation" : "godName",
    ]);
  }
  const remarks = new Map(kircher.remarks.map((row) => [row.no, row.remark]));
  return angels.map((angel) => {
    const beside = {
      kircher: kircher.rays[angel.no - 1],
      departs: departs.get(angel.no) ?? [],
      ...(remarks.has(angel.no) ? { remark: remarks.get(angel.no) } : {}),
    };
    const on1909 = reissue.get(angel.no);
    if (on1909) return { ...on1909, source: "plate1909" as const, ...beside };
    const on1823 = original.get(angel.no);
    if (on1823) return { ...on1823, source: "plate1823" as const, ...beside };
    return {
      ...fromEntries(angel.no),
      source: "reconstructed" as const,
      ...beside,
    };
  });
}

/** What Lenain's table has for one row on each plate that shows it. */
export function plateCells(no: number): {
  plate1909?: PlateRow;
  plate1823?: PlateRow;
} {
  return { plate1909: plate1909().get(no), plate1823: plate1823().get(no) };
}

/**
 * What the source column says of a row: where it comes from, and where it
 * parts from Kircher — "reconstructed; differs from Kircher in nation", or
 * "reconstructed; the entry names neither a nation nor a name of God" — with
 * any remark on an empty nation after it. Shared by the page and the
 * Markdown.
 */
export function sourceCell(row: FirstTableRow): string {
  const said = `${SOURCE_LABEL[row.source]}${row.partly ? ", partly legible" : ""}`;
  const named = (column: "nation" | "godName") => Boolean(row[column]);
  const unnamed = row.departs.filter((column) => !named(column));
  const differs = row.departs.filter(named);
  const clauses: string[] = [];
  if (unnamed.length === 2)
    clauses.push("the entry names neither a nation nor a name of God");
  else if (unnamed.length)
    clauses.push(`the entry names no ${COLUMN_NAME[unnamed[0]]}`);
  if (differs.length)
    clauses.push(
      `differs from Kircher in ${differs.map((column) => COLUMN_NAME[column]).join(" and ")}`,
    );
  const remarks = [row.remark, row.kircher.remark].filter(Boolean);
  const remark = remarks.length ? `. ${remarks.join(" ")}` : "";
  return `${[said, ...clauses].join("; ")}${remark}`;
}

/** 37 as "37th", 1 as "1st", 22 as "22nd". */
function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** "rows 2, 3 and 7", or "row 41". */
function rowList(numbers: number[]) {
  if (numbers.length < 2) return `row ${numbers.join("")}`;
  return `rows ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
}

/**
 * How closely Lenain's entries follow Kircher's plate, as a paragraph: how
 * many of the seventy-two rows agree in each column, and which do not.
 * Counted from the recorded departures, so it cannot go stale.
 */
export function kircherSentence(): string {
  const rowsOf = (field: KircherDeparture["field"]) => [
    ...new Set(
      kircher.departures
        .filter((departure) => departure.field === field)
        .map((departure) => departure.no),
    ),
  ];
  const nations = rowsOf("people");
  const names = rowsOf("godName");
  const total = kircher.rays.length;
  // Rows whose entry names no people but gives the name as some group's.
  const attributed = kircher.remarks.map((remark) => remark.no);
  const groups = attributed.map((no) => kircher.rays[no - 1].nation);
  const byAttribution = attributed.length
    ? `, the ${attributed.map(ordinal).join(" and ")} among them by ` +
      `attribution: their entries name no people, but give the name as ` +
      `that of Kircher's ${groups.join(" and ")}`
    : "";
  return (
    `Beside each row is the same ray of Kircher's plate of the names of ` +
    `God by nation (Oedipus Aegyptiacus II.1, 1653, the plate after p. 287), ` +
    `which Lenain cites under his table and whose two outer rings the ` +
    `table's last two columns follow row for row, from the Hebrews to ` +
    `Thrace. Allowing for spelling — V for U, a Greek name in roman ` +
    `letters — the entries give Kircher's name of God in ` +
    `${total - names.length} of the ${total} rows and his nation in ` +
    `${total - nations.length}${byAttribution}. They depart from him in the nation in ` +
    `${rowList(nations)}, and in the name of God in ${rowList(names)}; an ` +
    `editorial note on each such entry says what the plate has and whether ` +
    `the difference is Lenain's or the reissue's.`
  );
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
