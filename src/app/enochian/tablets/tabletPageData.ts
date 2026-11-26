import { type TabletName, tabletNames } from "magick-data/enochian/tabletNames";
import tabletNotes, {
  type TabletSource,
  versionNote,
} from "magick-data/enochian/tabletNotes";
import tablets, {
  TABLET_VERSIONS,
  type TabletVersionId,
  tabletVersion,
} from "magick-data/enochian/tablets";
import { displayName } from "./nameWords";
import { countDifferences } from "./squareReadings";
import type { TabletPageId } from "./tabletPages";

/**
 * What a tablet's page (plan 100) reads from magick-data, for the page,
 * its structured data and site search alike: the names in the Golden
 * Dawn's version, the lede's values, how many squares each other version
 * changes, and the sources its drawing follows.
 */

/** A tablet's names in the Golden Dawn's version, as the tool reads them. */
export function gdNames(id: TabletPageId): readonly TabletName[] {
  const view = tabletVersion(tablets[id], "gd");
  return view ? tabletNames(view) : [];
}

/**
 * The lede's and the Union's alt text's values, spelled as the names
 * list shows them: a Watchtower's three holy names (`first` to `third`)
 * and its King (`king`); the Union's four lines (`first` to `fourth`).
 */
export function tabletLedeValues(id: TabletPageId): Record<string, string> {
  const names = gdNames(id);
  const of = (kind: TabletName["kind"]) =>
    names
      .filter((name) => name.kind === kind)
      .map((name) => displayName(name.spelling));
  const [first = "", second = "", third = "", fourth = ""] = of(
    id === "union" ? "union" : "holyName",
  );
  return id === "union"
    ? { first, second, third, fourth }
    : { first, second, third, king: of("king")[0] ?? "" };
}

/** A tablet's squares: a Watchtower's 13 rows of 12, the Union's 4 of 5. */
export const tabletSquareCount = (id: TabletPageId) =>
  id === "union" ? 20 : 156;

/** One other version's count of squares that differ from the Golden Dawn's. */
export interface VersionCount {
  version: TabletVersionId;
  /** The version's title, from its note: "Regardie's print". */
  title: string;
  /** Squares whose letter differs, u for v, or one left empty; not case. */
  squares: number;
}

/**
 * How many squares each other version reads otherwise than the Golden
 * Dawn's, as the tool's Differences tab counts them (`countDifferences`):
 * a letter, u for v, or an empty square, but not case alone. A version
 * without the tablet (Dee's and Raphael's have no Union) is left out.
 */
export function versionCounts(id: TabletPageId): VersionCount[] {
  return TABLET_VERSIONS.filter((version) => version !== "gd").flatMap(
    (version) => {
      const count = countDifferences(id, "gd", version);
      return count
        ? [
            {
              version,
              title: versionNote(version)?.title ?? version,
              squares: count.letter + count.uv + count.empty,
            },
          ]
        : [];
    },
  );
}

/** A tablet's note: its quarter, Dee's name for it, and its sources. */
export const tabletNote = (id: TabletPageId) => tabletNotes.tablets[id];

/**
 * The sources the Golden Dawn's drawing follows: the note's Regardie
 * pages. The note's other sources (Casaubon, the Equinox) are cited for
 * Dee's names and the variants, not for the drawing.
 */
export const drawingSources = (id: TabletPageId): readonly TabletSource[] =>
  tabletNote(id).sources.filter((source) => source.work.startsWith("regardie"));
