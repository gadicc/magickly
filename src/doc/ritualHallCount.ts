/**
 * How many halls a compiled ritual holds, counted without parsing it (plan
 * 069, decision 8). The compiler writes compact JSON (`JSON.stringify`, in
 * semanticCompilerImpl.ts), so each `gdHall` row reads exactly
 * `"type":"gdHall"`; a caption, attribute or text holding those characters
 * is stored with its quotes escaped (`\"type\":\"gdHall\"`) and cannot
 * match. ritualHallCount.test.ts pins this against `semanticToJrt`.
 * In theory a key ending in an escaped quote and `type` (`"a\"type":"gdHall"`)
 * would match; element keys come from the compiler and a per-tag allow-list
 * of attribute names (validateRitualSemantic), so only an imported `legacy`
 * node's raw JSON could hold one.
 */
export const HALL_MARKER = '"type":"gdHall"';

/** The marker count over stored JSON text, as the catalog's SQL counts it. */
export function countHallMarkers(contentJson: string): number {
  return (
    (contentJson.length - contentJson.replaceAll(HALL_MARKER, "").length) /
    HALL_MARKER.length
  );
}

/** Every object anywhere in a parsed tree whose `type` is `gdHall`. */
export function countHallRows(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce<number>((sum, item) => sum + countHallRows(item), 0);
  if (!value || typeof value !== "object") return 0;
  let count = (value as { type?: unknown }).type === "gdHall" ? 1 : 0;
  for (const child of Object.values(value)) count += countHallRows(child);
  return count;
}

/**
 * A legacy archive is not the compiler's output, so its spacing and key
 * order are unknown: parse it. Unreadable content counts no halls.
 */
export function countHallRowsInJson(contentJson: string): number {
  try {
    return countHallRows(JSON.parse(contentJson.replace(/^﻿/, "")));
  } catch {
    return 0;
  }
}
