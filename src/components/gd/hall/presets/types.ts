import type { HallNode } from "../types";

/**
 * A ready-made hall (plan 061, Presets): a `gdHall` row tree, copied into a
 * ritual's source when inserted, with where its layout comes from. Layouts
 * are facts, drawn with the package's art, so presets are MIT.
 */
export interface HallPreset {
  /** A stable key, such as `zelator1`. */
  id: string;
  /** Its caption, such as "Zelator Temple 1". */
  title: string;
  /** The grade, as the rituals write it (`0=0`, `1=10`, `2=9`). */
  grade: string;
  /** Which part of the grade's ritual, for grades with more than one hall. */
  part?: number;
  /**
   * Stable references to what the layout follows: the book's diagram and
   * rubric. Never empty.
   */
  sources: readonly HallPresetSource[];
  hall: HallNode;
}

/**
 * Where a preset's layout comes from: a page of a book with a stable scan
 * (plan 061, Sources). Only primary sources are cited (Gadi, 28 October
 * 2026).
 */
export type HallPresetSource = {
  kind: "book";
  work: HallSourceWork;
  /** The printed page the diagram is on. */
  page: number;
  /** The scan's leaf (`n38`), which links to the page. */
  leaf: number;
  /** What the preset takes from it, when only part of its layout. */
  note?: string;
};

/** The books presets cite, with their archive.org items. */
export const HALL_SOURCE_WORKS = {
  regardie1938: {
    /** How a source line names it: "Regardie 1938, vol. 2". */
    title: "Regardie 1938, vol. 2",
    author: "Israel Regardie",
    book: "The Golden Dawn",
    volume: "vol. 2",
    publisher: "Aries Press, Chicago",
    year: 1938,
    archiveItem: "IsraelRegardie-TheGoldenDawn-Vol2-1938",
  },
} as const;
export type HallSourceWork = keyof typeof HALL_SOURCE_WORKS;

/** A page of Regardie's 1938 first edition, vol. 2. */
export const regardie1938 = (
  page: number,
  leaf: number,
  note?: string,
): HallPresetSource =>
  note === undefined
    ? { kind: "book", work: "regardie1938", page, leaf }
    : { kind: "book", work: "regardie1938", page, leaf, note };

/**
 * A source as one line of text: "Regardie 1938, vol. 2, p.44 (archive.org
 * leaf n38)" and the note in parentheses.
 */
export function hallSourceText(source: HallPresetSource): string {
  const { title } = HALL_SOURCE_WORKS[source.work];
  const note = source.note === undefined ? "" : ` (${source.note})`;
  return `${title}, p.${source.page} (archive.org leaf n${source.leaf})${note}`;
}

/**
 * A book source in full, for a file's metadata: "Israel Regardie, The
 * Golden Dawn, vol. 2 (Aries Press, Chicago, 1938), p.44, archive.org
 * leaf n38" and the note in parentheses.
 */
export function hallSourceCitation(source: HallPresetSource): string {
  const work = HALL_SOURCE_WORKS[source.work];
  const note = source.note === undefined ? "" : ` (${source.note})`;
  return `${work.author}, ${work.book}, ${work.volume} (${work.publisher}, ${work.year}), p.${source.page}, archive.org leaf n${source.leaf}${note}`;
}

/** Where a source can be seen: the book's page on archive.org. */
export function hallSourceUrl(source: HallPresetSource): string {
  const { archiveItem } = HALL_SOURCE_WORKS[source.work];
  return `https://archive.org/details/${archiveItem}/page/n${source.leaf}`;
}

/**
 * The dais of every Outer grade: the Chiefs, the Hierophant and his
 * predecessor, spread evenly, the row centred in the dais, labels
 * included.
 */
export function dais(): HallNode {
  return {
    type: "dais",
    children: [
      "imperator",
      "cancellarius",
      "hierophant",
      "pastHierophant",
      "praemonstrator",
    ].map((role) => ({ type: "officer", role })),
  };
}
