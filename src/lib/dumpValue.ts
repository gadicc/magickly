/**
 * One field of a row as JSON, for the entity pages that still print their
 * rows as a dump until [plan 036](../../plans/036-entity-pages.md) lays each
 * of them out.
 *
 * A linked row is printed as its id rather than as everything it reaches.
 * The barrel's rows are one graph, and once the graph gains the back-links
 * the entity pages read, a planet's or a letter's links reach most of the
 * data: printed whole through `decycle`, as these pages did, the 62 of them
 * would come to 144 MB of markup. The field's own value is printed whole,
 * so a link the page dumps shows that row's own fields and its links' ids,
 * one hop and no further.
 *
 * Every table a link can reach carries an `id` except the god names and the
 * angelic orders, which link to nothing, so no cycle survives the replacer
 * and `JSON.stringify` needs no `decycle`.
 */
export function dumpValue(value: unknown): string | undefined {
  return JSON.stringify(value, (key, nested) =>
    key !== "" && isRow(nested) ? nested.id : nested,
  );
}

/** A plain object with an id of its own: a row, not a block of one. */
function isRow(value: unknown): value is { id: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "id")
  );
}
