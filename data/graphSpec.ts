/**
 * The shape [graph.ts](./graph.ts) is written in.
 *
 * It is its own module so that the graph can be typed without depending on
 * the types derived from it ([types.ts](./types.ts) reads the graph, not the
 * other way round).
 */
import type { TableName } from "./tables";

/** An id-shaped field that names a row, or a list of rows, in another table. */
export interface LinkSpec {
  /** The table the id belongs to. */
  to: TableName;
  /** Set on an `Ids` field: the value is a list, and so is the accessor. */
  many?: boolean;
  /**
   * The field on the target row that must name this row back. Both directions
   * are stored, so the JSON stays self-contained for a reader that is not
   * JavaScript, and the check asserts the pair row by row.
   */
  mirrors?: string;
  /** An accessor to derive on the target row, pointing back at this one. */
  inverse?: string;
  /** Whether that derived accessor is a list. Without it, it must be unique. */
  inverseMany?: boolean;
  /** The accessor name, where the one the field name gives is not wanted. */
  as?: string;
}

/**
 * What one table's id-shaped fields are. Everything that is not a `link` is
 * listed anyway, so that the inventory is complete and an undeclared field
 * fails the check rather than passing unnoticed.
 */
export interface TableSpec {
  /** Fields that resolve to a row, by field name. */
  links?: Readonly<Record<string, LinkSpec>>;
  /** Fields naming a table that does not exist yet, by the name it would take. */
  pending?: Readonly<Record<string, string>>;
  /** Fields naming something outside `data/`, by what holds it. */
  external?: Readonly<Record<string, string>>;
  /** Fields whose values are an enumeration rather than a reference. */
  enum?: Readonly<Record<string, readonly string[]>>;
}

/** Every table, named exactly once. A table with no id-shaped field is `{}`. */
export type GraphSpec = Readonly<Record<TableName, TableSpec>>;
