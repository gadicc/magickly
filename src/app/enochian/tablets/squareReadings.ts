import { squareNotes } from "magick-data/enochian/tabletNotes";
import tablets, {
  readingLetter,
  readingMark,
  TABLET_SOURCES,
  TABLET_VERSIONS,
  type TabletDifference,
  type TabletSourceId,
  type TabletVersionId,
  type TabletView,
  tabletDifferences,
  tabletReading,
  tabletVersion,
} from "magick-data/enochian/tablets";

/** Each source by the name a reader knows it by. */
export const SOURCE_NAMES: Readonly<Record<TabletSourceId, string>> = {
  regardie1940: "Regardie, 1940",
  equinox1912: "The Equinox, 1912",
  greer: "Greer's edition",
  dee1584: "Dee's record, 1584",
  raphael1587: "Raphael's table, 1587",
};

/** A tablet's row by its key, or nothing for a key the data lacks. */
const tabletOf = (id: string) =>
  Object.hasOwn(tablets, id) ? tablets[id as keyof typeof tablets] : undefined;

/** A tablet in a version, or nothing. */
export const viewOf = (id: string, version: TabletVersionId) =>
  tabletVersion(tabletOf(id), version);

/** Letters as a reader says them: "y", "y and l". */
const and = (letters: readonly string[]) => letters.join(" and ");

/**
 * What one source has in a square, in words, from its reading: "y and l
 * over N and h", "N, reversed", "empty", with the letters first written,
 * a misprint and other readings where the source records them. Nothing
 * for a source without this tablet.
 */
export function printedIn(
  id: string,
  source: TabletSourceId,
  row: number,
  column: number,
): string | undefined {
  const tablet = tabletOf(id);
  const reading = tablet && tabletReading(tablet, source);
  if (!reading) return undefined;
  const letter = readingLetter(reading, row, column);
  const mark = readingMark(reading, row, column);
  const upper = letter ? and([letter, ...(mark?.beside ?? [])]) : "empty";
  const parts = [
    mark?.below?.length ? `${upper} over ${and(mark.below)}` : upper,
  ];
  if (mark?.reversed) parts[0] += ", reversed";
  if (mark?.dictated?.length) parts.push(`first written ${and(mark.dictated)}`);
  if (mark?.misprint) parts.push(`printed ${mark.misprint}, a misprint`);
  if (mark?.alt?.length) parts.push(`also read ${and(mark.alt)}`);
  if (mark?.doubt) parts.push(`${mark.doubt} doubt`);
  return parts.join("; ");
}

/** What every source with this tablet has in a square, by source. */
export function squareReadings(
  id: string,
  row: number,
  column: number,
): [TabletSourceId, string][] {
  return TABLET_SOURCES.flatMap((source) => {
    const text = printedIn(id, source, row, column);
    return text === undefined
      ? []
      : [[source, text] as [TabletSourceId, string]];
  });
}

/** A version's letter in a square, in words: "N, reversed", "empty". */
export function versionLetter(
  view: TabletView,
  row: number,
  column: number,
): string {
  const letter = view.grid[row]?.[column] ?? null;
  const mark = view.marks.find(
    (each) => each.row === row && each.column === column,
  );
  if (letter === null) return "empty";
  return mark?.reversed ? `${letter}, reversed` : letter;
}

/** A square, top row first. */
export interface Square {
  row: number;
  column: number;
}

/**
 * The squares where the sources differ, across every version, top row
 * first: where two versions differ in more than case, where a version
 * holds second letters, a doubt or a reversed letter, and where the notes
 * say something. Case alone is left out, since the 1587 print's small
 * letters would outline most of the tablet; the versions' comparisons
 * count it.
 */
export function differingSquares(id: string): Square[] {
  const views = TABLET_VERSIONS.flatMap((version) => {
    const view = viewOf(id, version);
    return view ? [view] : [];
  });
  const keys = new Set<number>();
  for (const view of views) {
    for (const mark of view.marks) keys.add(mark.row * 100 + mark.column);
    for (const other of views)
      for (const difference of tabletDifferences(view, other))
        if (difference.kind !== "case")
          keys.add(difference.row * 100 + difference.column);
  }
  for (const note of squareNotes(id)) keys.add(note.row * 100 + note.column);
  return [...keys]
    .sort((a, b) => a - b)
    .map((key) => ({ row: Math.floor(key / 100), column: key % 100 }));
}

/** How two versions of a tablet differ, counted by kind. */
export interface DifferenceCount {
  squares: readonly TabletDifference[];
  letter: number;
  uv: number;
  case: number;
  empty: number;
}

/** The squares where two versions of a tablet differ, and how many of each. */
export function countDifferences(
  id: string,
  from: TabletVersionId,
  to: TabletVersionId,
): DifferenceCount | undefined {
  const a = viewOf(id, from);
  const b = viewOf(id, to);
  if (!a || !b) return undefined;
  const squares = tabletDifferences(a, b);
  const of = (kind: TabletDifference["kind"]) =>
    squares.filter((each) => each.kind === kind).length;
  return {
    squares,
    letter: of("letter"),
    uv: of("uv"),
    case: of("case"),
    empty: of("empty"),
  };
}
