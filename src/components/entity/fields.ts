import type { TableName } from "@/../data/tables";

/**
 * What an entity page does with its table's row (plan 036, decision 12).
 *
 * Each page exports one of these as `fields` from a `fields.ts` beside it,
 * and [entityFields.test.ts](./entityFields.test.ts) asserts that `shown`
 * and `omitted` together are exactly the table's keys one level deep over
 * every row, with neither listing a key twice or both the same one. A link,
 * an inverse or a nested field added to the data then fails that test until
 * the page decides about it.
 *
 * A key is a top-level field, or `field.key` where the JSON gives the field
 * as an object: `color.king`, `name.he`, `hermetic.tarotId`, and a nested
 * link's accessor, `hermetic.hebrewLetter`. A link's accessor or an inverse
 * is a key of its own, never walked into: `godName`, not `godName.name`.
 */
export interface EntityFields {
  /** The table whose rows the page renders, as the registry names it. */
  table: TableName;
  /**
   * The keys the page renders. A declaration, not a proof: the page's
   * content tests are what bind a shown key to the markup.
   */
  shown: readonly string[];
  /** The keys the page deliberately leaves out, each with a comment on why. */
  omitted: readonly string[];
}
