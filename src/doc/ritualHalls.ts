import { planRitualFootnotes } from "./ritualFootnotes";
import { type RitualRowShape, rendersBody } from "./ritualRendersBody";

/** A compiled (JRT) row, as the reader receives it. */
export interface RitualRow extends RitualRowShape {
  text?: unknown;
  children?: RitualRow[];
  /** A row's other attributes (a task's role, a hall's settings…). */
  [attribute: string]: unknown;
}

/** A hall as the reader draws it (plan 069, decision 4). */
export interface RitualHall {
  /** 1-based, in the order the reader draws the halls. */
  ordinal: number;
  /** The hall's first non-empty caption, else "Hall N". */
  name: string;
  /** The top-level title before the hall (else the first after it). */
  context: string | null;
  /** The index, among the tree's children, of the context's title. */
  contextAt: number | null;
  /** The `gdHall` row itself. */
  row: RitualRow;
}

const childrenOf = (row: RitualRow): readonly RitualRow[] => row.children ?? [];

const titleText = (row: RitualRow) =>
  row.type === "title" && typeof row.text === "string" ? row.text : null;

function captionOf(hall: RitualRow): string | null {
  for (const child of childrenOf(hall))
    if (child.type === "caption" && typeof child.text === "string") {
      const text = child.text.trim();
      if (text) return text;
    }
  return null;
}

/**
 * The halls of a compiled ritual, in the order the reader (`Render` in
 * `blocks.jsx`) draws them. It walks as `Render` does, with the same
 * footnote plan: a footnote's body is drawn at its host (a `footnotes`
 * block or a task's footer) and one with no host is never drawn; a task's
 * children are drawn once to say and again to do, but a hall is listed
 * once, where it is first drawn.
 */
export function ritualHalls(tree: RitualRow): RitualHall[] {
  const plan = planRitualFootnotes<RitualRow>(
    tree,
    (row) => row.type as string,
    childrenOf,
    rendersBody,
  );
  const top = childrenOf(tree);
  const found: { row: RitualRow; at: number }[] = [];
  const seen = new Set<RitualRow>();
  // The top-level row being drawn: a footnote's body is drawn inside its
  // host's top-level row, so its context is taken from there.
  let at = -1;

  const drawBodies = (host: RitualRow) => {
    for (const note of plan.collections.get(host) ?? [])
      for (const child of childrenOf(note)) draw(child);
  };
  const draw = (row: RitualRow) => {
    switch (row.type) {
      case "gdHall":
        if (!seen.has(row)) {
          seen.add(row);
          found.push({ row, at });
        }
        return;
      // Only its reference mark is drawn in place.
      case "footnote":
        return;
      case "footnotes":
        drawBodies(row);
        return;
      case "task": {
        const body = childrenOf(row).filter(
          (child) => child.type !== "footnotes",
        );
        if (row.say) for (const child of body) draw(child);
        if (row.do) for (const child of body) draw(child);
        const explicit = childrenOf(row).find(
          (child) => child.type === "footnotes",
        );
        if (explicit) draw(explicit);
        else drawBodies(row);
        return;
      }
    }
    if (rendersBody(row)) for (const child of childrenOf(row)) draw(child);
  };
  // The root is the document, an untyped row whose children are drawn.
  top.forEach((row, index) => {
    at = index;
    draw(row);
  });

  return found.map(({ row, at }, i) => {
    let contextAt: number | null = null;
    for (let index = at; index >= 0 && contextAt === null; index--)
      if (titleText(top[index]) !== null) contextAt = index;
    for (let index = at + 1; index < top.length && contextAt === null; index++)
      if (titleText(top[index]) !== null) contextAt = index;
    return {
      ordinal: i + 1,
      name: captionOf(row) ?? `Hall ${i + 1}`,
      context: contextAt === null ? null : titleText(top[contextAt]),
      contextAt,
      row,
    };
  });
}

/** A Table of Contents entry: a top-level title, or a hall under one. */
export type RitualContentsEntry =
  | { type: "title"; text: string }
  | { type: "hall"; hall: RitualHall };

/**
 * The reader's Table of Contents (plan 069, decision 6): the top-level
 * titles in order, each followed by the halls whose context it is, so a
 * hall drawn before the first title is listed under that title. Halls with
 * no title at all come first.
 */
export function ritualContents(
  tree: RitualRow,
  halls: readonly RitualHall[],
): RitualContentsEntry[] {
  const hallsAt = (at: number | null) =>
    halls
      .filter((hall) => hall.contextAt === at)
      .map((hall) => ({ type: "hall" as const, hall }));
  const entries: RitualContentsEntry[] = hallsAt(null);
  childrenOf(tree).forEach((row, index) => {
    const text = titleText(row);
    if (text === null) return;
    entries.push({ type: "title", text }, ...hallsAt(index));
  });
  return entries;
}
