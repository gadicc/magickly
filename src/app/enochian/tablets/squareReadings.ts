import tablets, {
  readingLetter,
  readingMark,
  TABLET_SOURCES,
  type TabletSourceId,
  tabletReading,
} from "magick-data/enochian/tablets";

/** Each source by the name a reader knows it by. */
export const SOURCE_NAMES: Readonly<Record<TabletSourceId, string>> = {
  regardie1940: "Regardie, 1940",
  equinox1912: "The Equinox, 1912",
  greer: "Greer's edition",
  dee1584: "Dee's record, 1584",
  raphael1587: "Raphael's table, 1587",
};

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
  const tablet = Object.hasOwn(tablets, id)
    ? tablets[id as keyof typeof tablets]
    : undefined;
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
