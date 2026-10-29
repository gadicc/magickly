import type { HallSourceLocations } from "../gdHallPug";
import type { RitualSemanticNode } from "../semantic";
import { type HallElement, indexHall, rowPathKey } from "./hallModel";

/**
 * The hall editor's link between its source and its drawing (plan 063):
 * where each element of a hall stands in its header-less Pug source, and
 * which element a caret in that source belongs to, by compiled row path
 * (`HallEntry.rowPath`, the paths the drawing selects by).
 */

/** A 1-based line and column of the header-less hall source. */
export interface HallSourcePlace {
  line: number;
  column: number;
}

export interface HallSourceMap {
  /** Where the element at the row `path` starts (its tag name), if any. */
  placeOf(path: readonly number[]): HallSourcePlace | undefined;
  /**
   * The row path a caret at `place` selects: the element it belongs to,
   * `[]` for the hall's own lines, null outside the hall.
   */
  pathAt(place: HallSourcePlace): readonly number[] | null;
}

/** A node's start, and the row path a caret on it selects. */
interface Start extends HallSourcePlace {
  owner: readonly number[];
}

/**
 * The map of `source`, which holds `hall`. With `locations` (from
 * `parseHallSourceWithLocations`, the parse that gave `hall`) it reads
 * them; without, `source` must be the hall as `printHallSource` writes
 * it, one node per line in document order, indented two spaces a level,
 * and the map follows that layout without parsing. Null when the source
 * does not have that layout.
 *
 * A caret belongs to the node that starts on its line (the last at or
 * before its column, else the first). In a hall, every line starts a node
 * (a blank line too) but those that carry one on: an attribute list or a
 * `//-` comment continued onto further lines, at any indentation and with
 * blank lines among them. Such a line belongs to the node above it. After
 * the source's last line with content (blank lines after the hall, the
 * final empty line), lines are the hall's own; before the hall, outside
 * it. An element selects itself; a comment or blank line the element that
 * holds it.
 */
export function hallSourceMap(
  hall: HallElement,
  source: string,
  locations?: HallSourceLocations,
): HallSourceMap | null {
  const index = indexHall(hall);
  const lines = source.split("\n");
  const starts: Start[] = [];
  const places = new Map<string, HallSourcePlace>();
  let printed = 0;
  const visit = (
    node: RitualSemanticNode,
    depth: number,
    parent: readonly number[],
  ) => {
    printed++;
    const located = locations?.get(node);
    const blank = node.kind === "annotation" && node.style === "blank";
    const place = located
      ? { line: located.line, column: located.column ?? 1 }
      : { line: printed, column: blank ? 1 : depth * 2 + 1 };
    if (node.kind !== "element") {
      starts.push({ ...place, owner: parent });
      return;
    }
    // IDs are unique in a valid hall, so every element is indexed.
    const owner = index.byId.get(node.id)!.rowPath;
    places.set(rowPathKey(owner), place);
    starts.push({ ...place, owner });
    node.children?.forEach((child) => visit(child, depth + 1, owner));
  };
  visit(hall, 0, []);
  // The printer ends the source with a newline: one line per node, then
  // an empty one. Anything else was not printed from this hall.
  if (!locations && lines.length !== printed + 1) return null;
  starts.sort((a, b) => a.line - b.line || a.column - b.column);
  /** The last line with content: none of the hall's lines come after it. */
  let content = lines.length;
  while (content > 0 && !lines[content - 1].trim()) content--;

  /** Index of the last start on or before `line`, or -1. */
  const lastBefore = (line: number) => {
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (starts[middle].line <= line) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  };

  return {
    placeOf: (path) => places.get(rowPathKey(path)),
    pathAt({ line, column }) {
      if (!Number.isInteger(line) || line < 1 || line > lines.length)
        return null;
      let at = lastBefore(line);
      if (at >= 0 && starts[at].line === line) {
        // On a line where nodes start: the last at or before the caret.
        while (
          at > 0 &&
          starts[at - 1].line === line &&
          starts[at].column > column
        )
          at--;
        return starts[at].owner;
      }
      if (at < 0) return null;
      // A line that carries the node above it on, or one after the hall.
      return line <= content ? starts[at].owner : [];
    },
  };
}
