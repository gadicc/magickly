/** The fields of a compiled (JRT) row that decide whether the reader draws its children. */
export interface RitualRowShape {
  type?: string;
  say?: unknown;
  do?: unknown;
}

/** Rows the reader draws without drawing their children. */
const LEAF_TYPES: ReadonlySet<string> = new Set([
  "declareVar",
  "img",
  "br",
  "grade",
  "var",
  "stylesheet",
  "hr",
  "cursor",
  "text",
  // Drawn whole; its rows are never rendered as ritual content.
  "gdHall",
]);

/**
 * Whether the reader (`Render` in `blocks.jsx`) draws a row's children: a
 * task only when it says or does something, any other row unless it is a
 * leaf. Shared by the reader's footnote plan and `ritualHalls`, so both
 * walk what the reader draws.
 */
export function rendersBody(row: RitualRowShape): boolean {
  const { type, say, do: action } = row;
  return type === "task" ? !!(say || action) : !LEAF_TYPES.has(type as string);
}
