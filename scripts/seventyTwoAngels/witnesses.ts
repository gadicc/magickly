import { readFileSync } from "node:fs";
import JSON5 from "json5";

/**
 * The two other copies of Lenain read where a note turns on a value.
 *
 * The edition transcribes a reissue (recorded as 1909) that was reset from
 * scratch, so an error in it may be its compositor's rather than Lenain's.
 * `witnesses.json5` records what the 1823 printing and a handwritten copy of
 * it print at each such place, and whose slip the departure is. This module
 * reads that file and turns each reading into the links and the sentences a
 * note carries. See plan 033, "Other witnesses".
 */

export const WITNESSES_PATH =
  "packages/magick-data/src/kabbalah/lenain/witnesses.json5";

export type Verdict =
  | "reissue"
  | "reissueChanged"
  | "lenain"
  | "reissueCorrected"
  | "agree"
  | "absent"
  | "mixed";

const VERDICTS = new Set<Verdict>([
  "reissue",
  "reissueChanged",
  "lenain",
  "reissueCorrected",
  "agree",
  "absent",
  "mixed",
]);

/** What one copy prints at one place: `at` is its page or leaf. */
export interface WitnessRead {
  at: number;
  /** The value only; empty where the copy gives none. */
  reads: string;
}

export interface WitnessReading {
  no: number;
  field: string;
  verdict: Verdict;
  print1823: WitnessRead;
  ms5365?: WitnessRead;
  remark?: string;
}

/**
 * One witness as a note carries it, ready to link: a copy of Lenain, or
 * Kircher's plate of the names of God by nation, his source for two columns.
 */
export interface Witness {
  source: "print1823" | "ms5365" | "kircherPlate";
  /** "1823 printing, p. 57", "Ms 5365, leaf n66" or "Kircher's plate, ray 50". */
  label: string;
  /** The page ("57"), the archive.org leaf ("n66") or the ray ("ray 50"). */
  at: string;
  url: string;
  reads: string;
  /**
   * The mirrored page that shows it (a key of `MIRRORED_PAGES` in
   * src/sources/mirroredPages.ts), which the site opens in its lightbox
   * instead of following `url`.
   */
  mirror?: string;
}

/** A row of the first table as the 1823 plate shows it. */
export interface PlateRow1823 {
  no: number;
  name: string;
  nation: string;
  godName: string;
  /** Cut through by the fold, and only partly legible. */
  partly?: boolean;
}

export interface WitnessFile {
  readings: WitnessReading[];
  firstTable: { page: number; rows: PlateRow1823[] };
}

function checkRead(where: string, read: unknown): WitnessRead {
  const value = read as WitnessRead;
  if (!value || !Number.isInteger(value.at) || value.at < 1)
    throw new Error(`${where}: no page or leaf`);
  if (typeof value.reads !== "string")
    throw new Error(`${where}: "reads" is not a string`);
  return value;
}

/**
 * The file, checked on load: an unknown verdict, a reading without its page,
 * one place recorded twice, or a plate row out of order or out of range stops
 * the build rather than being trusted.
 */
export function readWitnesses(path = WITNESSES_PATH): WitnessFile {
  const file: WitnessFile = JSON5.parse(readFileSync(path, "utf8"));
  const seen = new Set<string>();
  for (const reading of file.readings) {
    const where = `Witness reading ${reading.no} ${reading.field}`;
    if (!Number.isInteger(reading.no) || reading.no < 0 || reading.no > 72)
      throw new Error(`${where}: not a genius or the book at large`);
    if (!VERDICTS.has(reading.verdict))
      throw new Error(`${where}: unknown verdict ${reading.verdict}`);
    const key = `${reading.no}|${reading.field}`;
    if (seen.has(key)) throw new Error(`${where}: recorded twice`);
    seen.add(key);
    checkRead(`${where}, 1823 printing`, reading.print1823);
    if (reading.ms5365) checkRead(`${where}, Ms 5365`, reading.ms5365);
  }
  let previous = 0;
  for (const row of file.firstTable?.rows ?? []) {
    if (!Number.isInteger(row.no) || row.no < 1 || row.no > 72)
      throw new Error(`1823 plate row ${row.no}: not one of the 72`);
    if (row.no <= previous)
      throw new Error(
        `1823 plate row ${row.no}: after row ${previous}, so repeated or out of order`,
      );
    previous = row.no;
  }
  return file;
}

const PRINT_1823 = "https://books.google.com/books?id=qt9SAAAAcAAJ";
const MS_5365 = "https://archive.org/details/BIUSante_ms05365";

/** The links a note carries, the printing first. */
export function witnessesOf(reading: WitnessReading): Witness[] {
  const { print1823, ms5365 } = reading;
  const witnesses: Witness[] = [
    {
      source: "print1823",
      label: `1823 printing, p. ${print1823.at}`,
      at: String(print1823.at),
      url: `${PRINT_1823}&pg=PA${print1823.at}`,
      reads: print1823.reads,
    },
  ];
  if (ms5365)
    witnesses.push({
      source: "ms5365",
      label: `Ms 5365, leaf n${ms5365.at}`,
      at: `n${ms5365.at}`,
      url: `${MS_5365}/page/n${ms5365.at}/mode/1up`,
      reads: ms5365.reads,
    });
  return witnesses;
}

const quoted = (reads: string) => `“${reads}”`;

const MONTHS: Record<string, number> = {
  janvier: 1,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
};

/**
 * The fields whose 1823 reading can be put in the edition's own notation and
 * so compared with what a note says the reissue prints. The rest are worded
 * differently on the two sides and are not compared: an invocation ("5:00
 * matin" against "depuis 5 heures du matin…"), a choir ("anges" against "le
 * chœur des anges") and a name of God. A Hebrew name is compared by its bare
 * letters instead.
 */
export const COMPARED_FIELDS = [
  "degrees",
  "presidingDays",
  "decade",
  "ordinal",
  "psalm.la",
  "revolutions",
];

/** A reading in the notation the apparatus records, or undefined. */
export function inNotation(field: string, reads: string): string | undefined {
  switch (field) {
    case "degrees":
      return reads.replace(/[–—]/g, "-");
    case "presidingDays":
      return reads
        .split(/,\s*/)
        .map((day) => {
          const [, date, month] = day.match(/^(\d+)\s+(\S+)$/) ?? [];
          if (!date || !MONTHS[month])
            throw new Error(`Cannot read the day "${day}" in "${reads}"`);
          return `${Number(date)}/${MONTHS[month]}`;
        })
        .join(", ");
    case "decade":
      return reads.match(/^\d+/)?.[0];
    case "ordinal":
    case "psalm.la":
    case "revolutions":
      return reads;
    default:
      return undefined;
  }
}

const lettersOf = (hebrew: string) => hebrew.replace(/\p{Mark}/gu, "");

/** The fields whose value is a word or phrase of the entry's own. */
const WORDED_FIELDS = new Set(["people", "godName"]);

/**
 * A nation or a name of God without what surrounds it in the entry: "la
 * langue des Samaritains" and "les Samaritains" are both "samaritains".
 * Case and accents are folded; the article and "la langue" are dropped.
 */
export function worded(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^(la )?langue\s+/, "")
    .replace(/^(des|de la|du|d'|les|le|la|l')\s*/, "")
    .trim();
}

/**
 * Whether a verdict fits what the note and the reading say, or why not. The
 * verdict is a person's judgement; this holds it to the values it is about,
 * so that a verdict cannot blame the reissue for a value the 1823 printing
 * shares, or Lenain for one it does not.
 */
export function verdictProblem(
  note: {
    no: number;
    field: string;
    printed: string;
    used: string;
    kind?: string;
  },
  reading: WitnessReading,
): string | undefined {
  const where = `Genius ${note.no} ${note.field}`;
  const reads = reading.print1823.reads;

  if (reading.verdict === "reissueChanged" && !reads)
    return `${where}: the reissue changed a value the 1823 printing does not give`;

  // A nation or a name of God in a reading note is the entry's own value,
  // so the 1823 entry's phrase can be held to it once the wording around
  // the value is set aside. A correction's printed value may come from
  // elsewhere (the seventy-second's KALO is the table's), so only readings.
  if (WORDED_FIELDS.has(note.field) && note.kind === "reading") {
    const ours = worded(note.printed);
    const theirs = worded(reads);
    if (reading.verdict === "lenain" && ours !== theirs)
      return `${where}: the 1823 printing reads “${reads}”, not the reissue's “${note.printed}”, yet the verdict says they agree`;
    if (
      (reading.verdict === "reissue" || reading.verdict === "reissueChanged") &&
      ours === theirs
    )
      return `${where}: the 1823 printing reads “${reads}”, as the reissue does, yet the verdict blames the reissue`;
    if (reading.verdict === "agree" && ours !== theirs)
      return `${where}: the 1823 printing reads “${reads}”, not “${note.printed}”, yet the verdict says it agrees`;
    return undefined;
  }

  if (note.field === "name.he") {
    const printed = lettersOf(note.printed);
    if (reading.verdict === "reissue" && printed === reads)
      return `${where}: the 1823 printing reads ${reads}, as the reissue does, yet the verdict blames the reissue`;
    if (
      (reading.verdict === "reissue" || reading.verdict === "agree") &&
      note.used !== reads
    )
      return `${where}: the name used is ${note.used}, but the 1823 printing reads ${reads} and is "${reading.verdict}"`;
    if (reading.verdict === "reissueCorrected" && note.used === reads)
      return `${where}: the name used is the 1823 printing's ${reads}, so the reissue corrected nothing`;
    return undefined;
  }

  const ours = inNotation(note.field, reads);
  if (ours === undefined) return undefined;
  if (reading.verdict === "reissue" && ours === note.printed)
    return `${where}: the 1823 printing has ${note.printed} too, yet the verdict blames the reissue`;
  if (reading.verdict === "lenain" && ours !== note.printed)
    return `${where}: the 1823 printing has ${ours}, not the reissue's ${note.printed}, yet the verdict says they agree`;
  return undefined;
}

/** What the value must be, for a note whose reason is only "the tables". */
const TABLES_REQUIRE = new Set([
  "presidingDays",
  "degrees",
  "invocation",
  "decade",
  "choir",
  "planet",
]);

/** What a field that gives an hour, or nothing, is called in a sentence. */
const ABSENT_AS: Record<string, string> = {
  invocation: "an hour",
};

/**
 * The reason a witnessed note gives, and what it then says is printed.
 *
 * `why` is the note's own reason; `generic` says it is only the stock "the
 * tables give otherwise", which the 1823 printing's reading can replace
 * outright where the slip turns out to be the reissue's.
 */
export function witnessedWhy(
  note: { no: number; field: string; why: string; printed: string },
  reading: WitnessReading,
  generic: boolean,
): { why: string; printed: string } {
  const { print1823, ms5365, verdict } = reading;
  const page = `p. ${print1823.at}`;
  const where = `${note.no} ${note.field}`;
  let why: string;
  let printed = note.printed;

  switch (verdict) {
    case "reissue": {
      if (!print1823.reads)
        throw new Error(`${where}: a reissue misprint needs the 1823 reading`);
      const said =
        `The reissue's resetting misprints this: the 1823 printing reads ` +
        `${quoted(print1823.reads)} (${page})`;
      why =
        generic && TABLES_REQUIRE.has(note.field)
          ? `${said}, as Lenain's own tables require.`
          : `${note.why} ${said}.`;
      break;
    }
    case "reissueChanged":
      if (!print1823.reads)
        throw new Error(`${where}: a change needs the 1823 reading`);
      why =
        `${note.why} The reissue changed this: the 1823 printing reads ` +
        `${quoted(print1823.reads)} (${page}).`;
      break;
    case "lenain":
      why = WORDED_FIELDS.has(note.field)
        ? `${note.why} The 1823 printing has the same (${page}), so the ` +
          `difference is Lenain's, not the reissue's.`
        : `${note.why} The 1823 printing has the same (${page}), so the slip ` +
          `is Lenain's or his printer's, not the reissue's.`;
      break;
    case "reissueCorrected":
      if (!print1823.reads)
        throw new Error(`${where}: a correction needs the 1823 reading`);
      why =
        `${note.why} The 1823 printing has ${quoted(print1823.reads)} ` +
        `(${page}); the reissue corrected it.`;
      break;
    case "agree":
      why = print1823.reads
        ? `${note.why} The 1823 printing agrees (${page}).`
        : `${note.why} The 1823 printing gives none either (${page}).`;
      break;
    case "mixed":
      // Part Lenain's, part the reissue's: the remark says which is which.
      if (!print1823.reads || !reading.remark)
        throw new Error(
          `${where}: a mixed verdict needs a reading and a remark`,
        );
      why = `${note.why} The 1823 printing has ${quoted(print1823.reads)} (${page}).`;
      break;
    case "absent": {
      const what = ABSENT_AS[note.field];
      if (!what)
        throw new Error(`${where}: no wording for a value that is absent`);
      if (print1823.reads)
        throw new Error(`${where}: absent, yet the 1823 printing reads it`);
      why =
        `Neither the 1823 printing (${page}) nor the reissue gives ${what} ` +
        `for this genius; the one used here is from Lenain's tables.`;
      printed = "";
      break;
    }
  }

  if (ms5365) {
    const leaf = `leaf n${ms5365.at}`;
    const copy = "The manuscript copy Ms 5365";
    if (ms5365.reads === print1823.reads)
      why += ms5365.reads
        ? ` ${copy} has the same (${leaf}).`
        : ` ${copy} gives none either (${leaf}).`;
    else
      why += ms5365.reads
        ? ` ${copy} reads ${quoted(ms5365.reads)} (${leaf}), a copyist's variant.`
        : ` ${copy} gives none (${leaf}), a copyist's variant.`;
  }
  if (reading.remark) why += ` ${reading.remark}`;
  return { why, printed };
}
