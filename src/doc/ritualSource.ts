import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { parseRitualText, printRitualText } from "./ritualText";
import type { RitualSemanticDocument } from "./semantic";

/** Draft source dialect; saved revisions continue to contain semantic JSON. */
export type RitualSourceDialect = "pug" | "ritual-text";

/** Only explicit format headers identify a dialect; malformed buffers are never guessed. */
export function detectRitualSourceDialect(
  source: string,
): RitualSourceDialect | null {
  const header = source.split(/\r?\n/, 1)[0];
  if (header === RITUAL_PUG_HEADER) return "pug";
  if (header === "ritual 1") return "ritual-text";
  return null;
}

/** Parse an explicitly selected source dialect without falling back on syntax errors. */
export function parseRitualSource(
  source: string,
  dialect: RitualSourceDialect,
): RitualSemanticDocument {
  return dialect === "pug" ? parseRitualPug(source) : parseRitualText(source);
}

/** Regenerate the selected source projection from the authoritative semantic tree. */
export function printRitualSource(
  document: RitualSemanticDocument,
  dialect: RitualSourceDialect = "pug",
): string {
  return dialect === "pug"
    ? printRitualPug(document)
    : printRitualText(document);
}
