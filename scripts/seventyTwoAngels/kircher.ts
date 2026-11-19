import { readFileSync } from "node:fs";
import JSON5 from "json5";
import {
  type KircherDeparture,
  type KircherNation,
  type KircherRay,
  plateCells,
} from "magick-data/kabbalah/lenain/firstTable";
import type { Note } from "./apparatus";
import type { Witness } from "./witnesses";

/**
 * Kircher's plate of the seventy-two names of God by nation, Lenain's source
 * for his first table's last two columns, and the notes saying where his
 * entries depart from it.
 *
 * The plate is read from `kircherPlate.json5`, and the places his entries
 * depart from it are recorded there by hand: a nation cannot be compared
 * with its Latin by rule, and only some names of God can (the test in
 * witnesses.test.ts holds the recorded names to the rule). What each note
 * says is built here from the plate and the entry, so the two cannot
 * disagree; whose the departure is comes from what the 1823 printing has,
 * in witnesses.json5. See plan 033, "Other witnesses".
 */

export const KIRCHER_PATH =
  "packages/magick-data/src/kabbalah/lenain/kircherPlate.json5";

/** The plate's page on Wikimedia Commons, the stable reference. */
export const KIRCHER_PLATE_PAGE =
  "https://commons.wikimedia.org/wiki/File:Kircher-Diagram_of_the_names_of_God_(22593924).jpg";

export interface KircherFile {
  rays: KircherRay[];
  departures: KircherDeparture[];
  nations: KircherNation[];
  remarks: { no: number; quote: string; remark: string }[];
}

const FIELDS = new Set(["people", "godName"]);

/**
 * The file, checked on load: seventy-two rays in order, each with a name and
 * a nation, and departures that name a ray and a field once each.
 */
export function readKircherPlate(path = KIRCHER_PATH): KircherFile {
  const file: KircherFile = JSON5.parse(readFileSync(path, "utf8"));
  if (file.rays.length !== 72)
    throw new Error(`Kircher's plate: ${file.rays.length} rays, not 72`);
  file.rays.forEach((ray, index) => {
    if (ray.ray !== index + 1)
      throw new Error(`Kircher's plate: ray ${ray.ray} where ${index + 1} is`);
    if (!ray.godName || !ray.nation)
      throw new Error(`Kircher's plate: ray ${ray.ray} is incomplete`);
  });
  const seen = new Set<string>();
  for (const departure of file.departures) {
    const key = `${departure.no}|${departure.field}`;
    if (!FIELDS.has(departure.field))
      throw new Error(`Departure ${key}: not a nation or a name of God`);
    if (
      !Number.isInteger(departure.no) ||
      departure.no < 1 ||
      departure.no > 72
    )
      throw new Error(`Departure ${key}: not one of the 72`);
    if (seen.has(key)) throw new Error(`Departure ${key}: recorded twice`);
    seen.add(key);
  }
  return file;
}

/** The entry's nation and name of God, as the edition records them. */
export interface EntryColumns {
  no: number;
  people: { fr: string };
  godName: string;
}

/** What a column is called in a note. */
const COLUMN: Record<KircherDeparture["field"], string> = {
  people: "nation",
  godName: "name of God",
};

/**
 * What Lenain's table has in that column on the plates that show the row:
 * "His table has “Les Célamites” on both plates (p. 25)." Nothing for a row
 * no plate shows.
 */
function tableSentence(departure: KircherDeparture): string {
  const column = departure.field === "people" ? "nation" : "godName";
  const { plate1909, plate1823 } = plateCells(departure.no);
  const later = plate1909?.[column];
  const original = plate1823?.[column];
  const quoted = (value: string) => `“${value}”`;
  if (later && original && later.toLowerCase() === original.toLowerCase())
    return ` His table has ${quoted(later)} on both plates (p. 25).`;
  if (later && original)
    return (
      ` His table has ${quoted(original)} on the 1823 plate and ` +
      `${quoted(later)} on the reissue's (p. 25).`
    );
  if (original)
    return ` His table has ${quoted(original)} on the 1823 plate (p. 25).`;
  if (later)
    return ` His table has ${quoted(later)} on the reissue's plate (p. 25).`;
  return "";
}

/**
 * What a name of God's note says of letters the reader was unsure of: the
 * reader's confidence is in the engraved names (rays 1 to 5, 7, 15, 68 and
 * 69), so only a name of God's note says it.
 */
function letters(ray: KircherRay): string {
  if (!ray.confidence) return "";
  const how =
    ray.confidence === "low"
      ? "The engraved letters are a best guess"
      : "The reading of the engraved letters is uncertain";
  return ray.note ? ` ${how}. ${ray.note}` : ` ${how}.`;
}

/**
 * A note for each place an entry departs from Kircher's plate. It keeps
 * Lenain's words, as every note does, so `used` is empty and the kind is a
 * reading: what he made of his source, not something this edition corrects.
 * `printed` is the entry's value, or empty where the entry names none.
 */
export function kircherNotes(
  file: KircherFile,
  entries: EntryColumns[],
): Note[] {
  return file.departures.map((departure) => {
    const ray = file.rays[departure.no - 1];
    const entry = entries.find((row) => row.no === departure.no);
    if (!entry) throw new Error(`Departure ${departure.no}: no such entry`);
    const printed =
      departure.field === "people" ? entry.people.fr : entry.godName;
    const engraved =
      departure.field === "people"
        ? `${ray.nation}${departure.gloss ? ` (${departure.gloss})` : ""}`
        : ray.godName;
    const column = COLUMN[departure.field];
    const entrySays = printed
      ? `the entry has “${printed}”`
      : `the entry gives no ${column}`;
    const why =
      `Kircher's plate, Lenain's source for this column, has ${engraved} ` +
      `as the ${column} of ray ${ray.ray}; ${entrySays}.` +
      (departure.field === "godName" ? letters(ray) : "") +
      (departure.cause ? ` ${departure.cause}` : "") +
      tableSentence(departure);
    return {
      no: departure.no,
      kind: "reading" as const,
      field: departure.field,
      printed,
      used: "",
      why,
    };
  });
}

/** The plate as a note's witness: its ray, linked to the mirror. */
export function plateWitness(
  ray: KircherRay,
  field: KircherDeparture["field"],
): Witness {
  return {
    source: "kircherPlate",
    label: `Kircher's plate, ray ${ray.ray} (numbered on the rim)`,
    at: `ray ${ray.ray}`,
    url: KIRCHER_PLATE_PAGE,
    reads: field === "people" ? ray.nation : ray.godName,
    mirror: "kircherPlate",
  };
}
