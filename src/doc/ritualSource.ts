import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { parseRitualText, printRitualText } from "./ritualText";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticToJrt,
} from "./semantic";
import { withoutEmptyText } from "./semanticNormalize";

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

/** Recover annotations from a clean pre-annotation Pug draft without replacing its identities. */
export function restorePugDraftAnnotations(
  document: RitualSemanticDocument,
  source: string,
): RitualSemanticDocument {
  return restoreDraftSourceAnnotations(document, source, "pug");
}

/** Recover clean source trivia while retaining the authoritative document's identities. */
export function restoreDraftSourceAnnotations(
  document: RitualSemanticDocument,
  source: string,
  dialect: RitualSourceDialect,
): RitualSemanticDocument {
  // Older buffers and drafts may still hold empty text nodes, which the
  // editor now drops from loaded documents; compare and restore without them.
  const parsed = withoutEmptyText(parseRitualSource(source, dialect));
  const authority = withoutEmptyText(document);
  const canonical = (value: unknown) =>
    JSON.stringify(value, (_key, entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, entry[key]]),
          )
        : entry,
    );
  if (canonical(semanticToJrt(parsed)) !== canonical(semanticToJrt(authority)))
    throw new Error("The saved source and document need manual recovery");
  const restore = (
    current: RitualSemanticNode[],
    previous: RitualSemanticNode[],
  ) => {
    const retained = previous.filter((node) => node.kind !== "annotation");
    let index = 0;
    for (const node of current) {
      if (node.kind === "annotation") continue;
      const old = retained[index++];
      if (!old || old.kind !== node.kind)
        throw new Error("Draft structure needs manual recovery");
      if ("id" in node && "id" in old) node.id = old.id;
      if (node.kind === "element" && old.kind === "element")
        restore(node.children ?? [], old.children ?? []);
    }
  };
  restore(parsed.nodes, authority.nodes);
  return parsed;
}
