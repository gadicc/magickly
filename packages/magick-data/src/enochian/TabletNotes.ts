import notes from "../../dist/enochian/tabletNotes.js";
import type { EnochianTabletID } from "./Tablets.ts";

/**
 * Notes on the Enochian tablets (plan 061, stage G): where the versions come
 * from, how they differ, each tablet's sources, and what the sources print
 * in particular squares. The prose is ours; the works are cited by stable
 * reference. Squares are counted from 0, as the tablets' grids and `marks`
 * count them, so a square's note sits beside its mark; a source `version`
 * (Dee 1584, Raphael 1587, the Golden Dawn) can hang off the same keys.
 */

/** The works the notes cite. */
export type TabletWorkId =
  | "sloane3191"
  | "casaubon1659"
  | "equinox1912"
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

/** A place in a work: a printed page or plate, and the scan's leaf. */
export interface TabletSource {
  work: TabletWorkId;
  page?: number;
  plate?: string;
  leaf?: number;
}

/** A titled paragraph: a version of the tablets, or a way they differ. */
export interface TabletTopic {
  id: string;
  title: string;
  text: string;
  sources: readonly TabletSource[];
}

/** One tablet's note: which version its letters are, and where they are from. */
export interface TabletNote {
  /** `gd`: the Golden Dawn's, from these sources; `older`: unsourced. */
  version: "gd" | "older";
  text: string;
  sources: readonly TabletSource[];
}

/** What the sources print in one square, and a note on the grid's reading. */
export interface SquareNote {
  row: number;
  column: number;
  /**
   * The Golden Dawn's letter, on a tablet whose letters are older and
   * differ from it here (Earth and Air).
   */
  goldenDawn?: string;
  /** Each source's letters, "x over y" where Regardie prints two. */
  printed: { regardie1940: string; equinox1912: string; greer: string };
  note: string;
  sources: readonly TabletSource[];
}

/** Everything the notes hold. */
export interface TabletNotes {
  works: Readonly<Record<TabletWorkId, TabletWork>>;
  versions: readonly TabletTopic[];
  differences: readonly TabletTopic[];
  tablets: Readonly<Record<EnochianTabletID, TabletNote>>;
  squares: Readonly<Partial<Record<EnochianTabletID, readonly SquareNote[]>>>;
}

const tabletNotes: TabletNotes = notes as TabletNotes;

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

/** A source as a line of text: "Regardie 1940 … p.271 (archive.org leaf n263)". */
export function sourceText(source: TabletSource): string {
  const work = tabletNotes.works[source.work];
  const place = [
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
