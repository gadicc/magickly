/**
 * One row of a table, by an id that is only a string.
 *
 * The repository compiles with `strict: false`, so `data.sephirah[id]` where
 * `id` is a `string` is silently `any`: every guarantee the row types give —
 * the fields, the links, their optionality — is erased at the one place a
 * dynamic route reaches the data, and a typo reads as a row rather than as
 * `undefined` (plan 032, decision 9).
 *
 * This is the whole of the fix: an own-property lookup that returns the
 * table's row type or `undefined`, so an unknown id is a value the caller
 * must handle and a known one keeps its type. `Object.hasOwn` is what makes
 * `rowOf(table, "constructor")` `undefined` rather than a function.
 *
 * It takes the table rather than living on it, because a table is a plain
 * frozen object that crosses the Server → Client boundary; a method would not
 * ([assemble.ts](./assemble.ts)).
 */

/** The row `id` names, or `undefined` where the table has no such own key. */
export function rowOf<T extends object>(
  table: T,
  id: string,
): T[keyof T] | undefined {
  return Object.hasOwn(table, id)
    ? (table as { [key: string]: T[keyof T] })[id]
    : undefined;
}

export default rowOf;
