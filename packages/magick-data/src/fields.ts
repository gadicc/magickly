import manifest from "../dist/fields.js";

/**
 * The field manifest (plan 080, decision 6): every table's fields, typed
 * and described, and the texts beside them, as [the build](./build.ts)
 * writes it to `dist/fields.json` from [schemas.ts](./schemas.ts),
 * [graph.ts](./graph.ts) and the data. The row types are generated, so no
 * hand-written field exists to carry a comment; this is where a field's
 * meaning is written down for a reader, and the app's data pages render
 * from it.
 *
 * A reader takes the structured parts (`type`, `link`, `columns`), never
 * the `display` string, which is for people.
 */

/** What a value is, as the schema says; a nested object lists its keys. */
export type FieldType =
  | { kind: "string"; constraints?: Constraints }
  | { kind: "number"; constraints?: Constraints }
  | { kind: "boolean" }
  | {
      kind: "picklist";
      /** Every value the field may take. */
      values: readonly (string | number)[];
    }
  | {
      kind: "object";
      /**
       * Its keys, in the schema's order. Each is a field of its own,
       * at `<path>.<key>`.
       */
      keys: readonly string[];
    }
  | {
      kind: "map";
      /**
       * Its keys. A map is an object with the same schema under every key,
       * four keys or more, so its fields are listed once, at `<path>.*`.
       */
      keys: readonly string[];
      /** The value under each key. */
      of: FieldType;
    }
  | { kind: "array"; of: FieldType }
  | { kind: "tuple"; of: readonly FieldType[] };

/** What a schema's validations add to its type. */
export interface Constraints {
  /** A regular expression the whole value matches, as its source. */
  pattern?: string;
  /** Set when a number must be an integer. */
  integer?: true;
  /** The least a number may be. */
  min?: number;
  /** Rules written as checks, by their messages. */
  rules?: readonly string[];
}

/**
 * Where an id-shaped field points, as [the graph](./graph.ts) declares it:
 * `link`, a row of the table `to`; `pending`, a table that does not exist
 * yet, by the name it would take; `external`, something outside the
 * package, by what holds it.
 */
export interface FieldLink {
  kind: "link" | "pending" | "external";
  to: string;
  /** Whether the value is a list of ids. */
  many: boolean;
}

/** One field of a table's rows, or of an object inside them. */
export interface Field {
  /**
   * Its path in the row: keys joined by `.`, `[]` for an array's elements
   * and `*` for every key of a map (`readings.*.rows`).
   */
  path: string;
  type: FieldType;
  /** Whether a row may leave it out. */
  optional: boolean;
  /** Whether a row may spell it `null`. */
  nullable: boolean;
  link?: FieldLink;
  /**
   * The keys of an object a table shows as columns, where it names them
   * (`v.metadata({ columns })`); otherwise every key is one.
   */
  columns?: readonly string[];
  /** The type as TypeScript would write it, for people. */
  display: string;
  /** What it holds, from its schema's `v.description()`. */
  description?: string;
}

/**
 * What names a row: a field (`id` for most tables, `index` or `no` for two
 * of the arrays), or, for an object table with no such field, its key.
 */
export type RowKey = { field: string } | { key: true };

/** One table. */
export interface TableFields {
  /** What the table holds, from its schema's description. */
  description?: string;
  /** Its subpath, which exports the rows raw: `./kabbalah/sephirot`. */
  subpath: string;
  /** Its source in the repository, under `src/`: `kabbalah/sephirot.json5`. */
  source: string;
  /** Whether the rows are an object keyed by id or an array. */
  shape: "object" | "array";
  rows: number;
  rowKey: RowKey;
  /** Rules across fields, which the schema checks, by their messages. */
  rules: readonly string[];
  /** Every field, nested ones after the field they are in. */
  fields: readonly Field[];
}

/** A published subpath that is a text or derived values, not a table. */
export interface TextEntry {
  /**
   * The data files it is read from, as their sources under `src/`; none
   * for one computed in code.
   */
  sources: readonly string[];
  /** The bytes of those files' JSON, together; `null` for none. */
  size: number | null;
  description: string;
  /** The page on magick.ly that presents it, if one does. */
  page: string | null;
}

export interface FieldManifest {
  /** Every table, by name, in the order `magick-data/tables` names them. */
  tables: Readonly<Record<string, TableFields>>;
  /** Every text, by the subpath a consumer imports. */
  texts: Readonly<Record<string, TextEntry>>;
}

const fields: FieldManifest = manifest as FieldManifest;
export default fields;
