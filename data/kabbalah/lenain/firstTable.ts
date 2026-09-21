import angels from "../SeventyTwoAngels";
import { leaves } from "./volume";

/**
 * The first cabalistic table, whole again.
 *
 * It is a fold-out leaf and the scan photographed it folded: rows 1 to 61 are
 * in no image of this copy, and only 62 to 72 survive. Every column it carries
 * — the genius, the nation, that nation's name for God — is also given in the
 * genius's own entry, so nothing it held is lost, only its arrangement. This
 * puts the arrangement back.
 *
 * It is derived and never stored in `pages.json5`. That file is what the page
 * prints, and a reconstruction written into it would be indistinguishable from
 * a reading a year from now — which is the one thing an edition whose whole
 * argument is "here is the evidence" cannot afford. The surviving rows come
 * from the transcription; the rest are marked as reconstructed wherever they
 * are shown, and the apparatus carries the note explaining why. See plan 033.
 */

/** Where the fold-out stops being legible; 62 onwards are on the plate. */
export const PRINTED_FROM = 62;

export interface FirstTableRow {
  no: number;
  /** The genius, as the entries romanise it. */
  name: string;
  /** The nation, in Lenain's own French. */
  nation: string;
  /** That nation's name for God, set in capitals as the table sets them. */
  godName: string;
  /** Whether this row is on the plate or put back from the entries. */
  source: "printed" | "reconstructed";
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
 * The rows still on the plate, as the plate sets them.
 *
 * A row marked "on the plate" must show what the plate shows, or the label
 * claims a provenance the value has not got: Lenain's table reads "Les
 * Carmaniens" and "Mogols" where his entries read "les anciens Carmaniens"
 * and "Mongols", and showing the entry's wording under his table's name would
 * put words in it. The sixty-second's name is blank there, and stays blank.
 */
function fromPlate() {
  const rows = new Map<number, string[]>();
  for (const leaf of leaves) {
    if (leaf.page.anchor !== "p25") continue;
    for (const block of leaf.blocks) {
      if (block.kind !== "table") continue;
      for (const row of block.rows) {
        const no = Number(row[0]?.replace(/\D/g, ""));
        if (no >= 1 && no <= 72) rows.set(no, row);
      }
    }
  }
  return rows;
}

export function firstTable(): FirstTableRow[] {
  const plate = fromPlate();
  return angels.map((angel) => {
    const printed = plate.get(angel.no);
    if (printed)
      return {
        no: angel.no,
        name: cell(printed[1] ?? ""),
        nation: cell(printed[2] ?? ""),
        godName: cell(printed[3] ?? ""),
        source: "printed" as const,
      };
    return {
      no: angel.no,
      name: angel.name.en,
      nation: nationOf(angel.people.fr),
      godName: angel.godName.toUpperCase(),
      source: "reconstructed" as const,
    };
  });
}

/** How many rows the plate gives, and how many had to be put back. */
export function firstTableCounts() {
  const rows = firstTable();
  return {
    printed: rows.filter((row) => row.source === "printed").length,
    reconstructed: rows.filter((row) => row.source === "reconstructed").length,
  };
}
