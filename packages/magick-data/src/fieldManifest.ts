/**
 * Writes the field manifest ([fields.ts](./fields.ts) says what it is) from
 * the schemas, the graph and the data. [The build](./build.ts) calls it and
 * emits the result as `dist/fields.json`.
 *
 * The schemas use only object, string, number, boolean, picklist, array,
 * tuple, optional and nullable, with `v.pipe` for validations and
 * descriptions; a kind outside those throws, as `picklistPaths` does, so
 * that a new one is read on purpose rather than passed over.
 */
import type { GenericSchema } from "valibot";
import type {
  Constraints,
  Field,
  FieldLink,
  FieldManifest,
  FieldType,
  RowKey,
  TableFields,
  TextEntry,
} from "./fields.ts";
import type { TableSpec } from "./graphSpec.ts";
import type { TableName } from "./tables.ts";

/** A step of a `v.pipe`: a validation, a description or metadata. */
interface PipeItem {
  kind: string;
  type: string;
  requirement?: unknown;
  message?: unknown;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** The parts of a valibot schema this reads. */
interface SchemaNode {
  type: string;
  entries?: Record<string, SchemaNode>;
  wrapped?: SchemaNode;
  item?: SchemaNode;
  items?: SchemaNode[];
  options?: (string | number)[];
  pipe?: (SchemaNode | PipeItem)[];
}

/**
 * A map has the same schema under every key, and at least this many keys:
 * `tetragram.meanings` (the twelve houses) and `enochianTablet.readings`
 * (five sources). Fewer keys, such as a name in three languages, read
 * better as a column each.
 */
export const MAP_MIN_KEYS = 4;

/**
 * The arrays with no `id`, and the field that names their rows instead
 * (plan 080, decision 4). An object table with no `id` is named by its key.
 */
const ARRAY_ROW_KEYS: Partial<Record<TableName, string>> = {
  astrologicalHouse: "index",
  seventyTwoAngel: "no",
};

/** A schema as it is under its `optional` and `nullable` wrappers. */
interface Unwrapped {
  node: SchemaNode;
  optional: boolean;
  nullable: boolean;
  /** Descriptions and metadata from every layer, outermost first. */
  steps: PipeItem[];
}

/**
 * A schema's pipe steps, outermost first: `v.pipe(tabletIndex,
 * v.description("…"))` nests one pipe in another, and the outer
 * description is the field's own.
 */
function stepsOf(node: SchemaNode): PipeItem[] {
  if (!node.pipe) return [];
  const [root, ...rest] = node.pipe;
  return [...(rest as PipeItem[]), ...stepsOf(root as SchemaNode)];
}

/**
 * Looks through `optional` and `nullable` to the schema they wrap, keeping
 * any pipe steps on the way: a description is written as
 * `v.optional(v.pipe(x, v.description("…")))`, the wrapper outermost.
 */
function unwrap(schema: SchemaNode): Unwrapped {
  let node = schema;
  let optional = false;
  let nullable = false;
  const steps: PipeItem[] = [];
  for (;;) {
    steps.push(...stepsOf(node));
    if (node.type === "optional" && node.wrapped) {
      optional = true;
      node = node.wrapped;
    } else if (node.type === "nullable" && node.wrapped) {
      nullable = true;
      node = node.wrapped;
    } else return { node, optional, nullable, steps };
  }
}

const descriptionOf = (steps: PipeItem[]) =>
  steps.find((step) => step.type === "description")?.description;

/** Metadata from every step, the outermost winning. */
const metadataOf = (steps: PipeItem[]) =>
  Object.assign(
    {},
    ...steps
      .filter((step) => step.type === "metadata")
      .map((step) => step.metadata)
      .reverse(),
  ) as Record<string, unknown>;

/** The messages of a pipe's `v.check`s, which a reader can only be told. */
const rulesOf = (steps: PipeItem[]) =>
  steps
    .filter((step) => step.type === "check")
    .map((step, i) =>
      typeof step.message === "string" ? step.message : `check ${i + 1}`,
    );

function constraintsOf(steps: PipeItem[]): Constraints | undefined {
  const constraints: Constraints = {};
  for (const step of steps) {
    if (step.type === "regex")
      constraints.pattern = (step.requirement as RegExp).source;
    else if (step.type === "integer") constraints.integer = true;
    else if (step.type === "min_value")
      constraints.min = step.requirement as number;
  }
  const rules = rulesOf(steps);
  if (rules.length) constraints.rules = rules;
  return Object.keys(constraints).length ? constraints : undefined;
}

/**
 * Whether an object's entries are a map: at least `MAP_MIN_KEYS` keys, each
 * the same schema (the same object, not merely an equal one) under the same
 * wrappers. Identity keeps the rule from catching an object whose keys
 * happen to share a type, such as a sephirah's colours.
 */
function isMap(entries: Record<string, SchemaNode>) {
  const values = Object.values(entries).map(unwrap);
  if (values.length < MAP_MIN_KEYS) return false;
  const [first] = values;
  return values.every(
    (value) =>
      value.node === first.node &&
      value.optional === first.optional &&
      value.nullable === first.nullable,
  );
}

/** A schema's type, structured; an object's keys, not their types. */
function typeOf(node: SchemaNode, path: string): FieldType {
  const steps = stepsOf(node);
  switch (node.type) {
    case "string":
    case "number": {
      const constraints = constraintsOf(steps);
      return constraints
        ? { kind: node.type, constraints }
        : { kind: node.type };
    }
    case "boolean":
      return { kind: "boolean" };
    case "picklist":
      return { kind: "picklist", values: [...(node.options ?? [])] };
    case "strict_object":
    case "object": {
      const entries = node.entries ?? {};
      if (isMap(entries))
        return {
          kind: "map",
          keys: Object.keys(entries),
          of: typeOf(unwrap(Object.values(entries)[0]).node, `${path}.*`),
        };
      return { kind: "object", keys: Object.keys(entries) };
    }
    case "array":
      return { kind: "array", of: typeOf(unwrap(node.item!).node, path) };
    case "tuple":
      return {
        kind: "tuple",
        of: (node.items ?? []).map((item) => typeOf(unwrap(item).node, path)),
      };
    default:
      throw new Error(
        `${path || "the row"}: a ${node.type} schema, which the field manifest does not read`,
      );
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** A type as TypeScript would write it, for people. */
function display(node: SchemaNode): string {
  switch (node.type) {
    case "picklist":
      return (node.options ?? []).map((o) => JSON.stringify(o)).join(" | ");
    case "strict_object":
    case "object": {
      const entries = node.entries ?? {};
      if (isMap(entries)) {
        const value = unwrap(Object.values(entries)[0]);
        const keys = Object.keys(entries)
          .map((key) => JSON.stringify(key))
          .join(" | ");
        const of = `${display(value.node)}${value.nullable ? " | null" : ""}`;
        return `{ [key in ${keys}]${value.optional ? "?" : ""}: ${of} }`;
      }
      const members = Object.entries(entries).map(([key, entry]) => {
        const value = unwrap(entry);
        const name = IDENTIFIER.test(key) ? key : JSON.stringify(key);
        return `${name}${value.optional ? "?" : ""}: ${display(value.node)}${value.nullable ? " | null" : ""}`;
      });
      return `{ ${members.join("; ")} }`;
    }
    case "array": {
      const item = unwrap(node.item!);
      const of = display(item.node);
      return /[ |]/.test(of) && !of.startsWith("{") ? `(${of})[]` : `${of}[]`;
    }
    case "tuple":
      return `[${(node.items ?? []).map((item) => display(unwrap(item).node)).join(", ")}]`;
    default:
      return node.type;
  }
}

/** Every id-shaped field in a table's graph entry, by its path. */
function linksOf(spec: TableSpec): Map<string, FieldLink> {
  const links = new Map<string, FieldLink>();
  for (const [field, link] of Object.entries(spec.links ?? {}))
    links.set(field, { kind: "link", to: link.to, many: !!link.many });
  for (const [field, to] of Object.entries(spec.pending ?? {}))
    links.set(field, { kind: "pending", to, many: field.endsWith("Ids") });
  for (const [field, to] of Object.entries(spec.external ?? {}))
    links.set(field, { kind: "external", to, many: field.endsWith("Ids") });
  return links;
}

/**
 * Every field of a row, depth first: an object's keys after the object,
 * an array of objects' after the array (at `[]`), a map's once (at `*`).
 */
function fieldsOf(schema: SchemaNode, links: Map<string, FieldLink>): Field[] {
  const fields: Field[] = [];
  const visit = (entries: Record<string, SchemaNode>, prefix: string) => {
    for (const [key, entry] of Object.entries(entries)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const { node, optional, nullable, steps } = unwrap(entry);
      const field: Field = {
        path,
        type: typeOf(node, path),
        optional,
        nullable,
        display: `${display(node)}${nullable ? " | null" : ""}`,
      };
      const link = links.get(path);
      if (link) field.link = link;
      const { columns } = metadataOf(steps);
      if (Array.isArray(columns)) field.columns = columns as string[];
      const description = descriptionOf(steps);
      if (description) field.description = description;
      fields.push(field);
      descend(node, path);
    }
  };
  const descend = (node: SchemaNode, path: string) => {
    if (node.type === "strict_object" || node.type === "object") {
      const entries = node.entries ?? {};
      if (!isMap(entries)) return visit(entries, path);
      // The map's value, once, as if it were the only key.
      const [first] = Object.values(entries);
      visit({ "*": first }, path);
    } else if (node.type === "array" && node.item)
      descend(unwrap(node.item).node, `${path}[]`);
  };
  descend(unwrap(schema).node, "");
  return fields;
}

/** What names a table's rows, checked against the rows themselves. */
function rowKeyOf(table: TableName, schema: SchemaNode, rows: unknown): RowKey {
  const entries = unwrap(schema).node.entries ?? {};
  const field = "id" in entries ? "id" : ARRAY_ROW_KEYS[table];
  const list = Array.isArray(rows)
    ? rows
    : Object.values(rows as Record<string, unknown>);
  if (!field) {
    if (Array.isArray(rows))
      throw new Error(`${table}: an array with no field to name its rows`);
    return { key: true };
  }
  if (!(field in entries))
    throw new Error(`${table}: rows are named by ${field}, which it lacks`);
  const keys = list.map((row) =>
    String((row as Record<string, unknown>)[field]),
  );
  if (new Set(keys).size !== list.length)
    throw new Error(`${table}: ${field} does not name each row once`);
  return { field };
}

/** A text as `TEXTS` declares it; the build adds its size. */
export interface TextSpec {
  /** Its data files, as their sources under `src/`, without `.json5`. */
  sources: readonly string[];
  description: string;
  page: string | null;
}

/**
 * Every published subpath that is neither a table nor code, with what it
 * holds and the page that presents it (plan 080, decision 6). A text's
 * JSON is published at `json/<source>.json`; one with no module of its
 * own is keyed by that path. [build.test.ts](./build.test.ts) holds this
 * to the package's exports and its sources.
 */
export const TEXTS: Readonly<Record<string, TextSpec>> = {
  "./enochian/keys": {
    sources: ["enochian/keys"],
    description:
      "The nineteen Enochian Keys, one row per word as Dee received it, with its English and each work's reading of it, and the functions that give a version of each Key.",
    page: "/enochian/keys",
  },
  "./enochian/tabletNotes": {
    sources: ["enochian/tabletNotes"],
    description:
      "Notes on the Enochian tablets: each version and where it comes from, each tablet, and particular squares, with the works they cite.",
    page: "/enochian/tablets",
  },
  "./kabbalah/seventyTwoAngels/text": {
    sources: [
      "kabbalah/seventyTwoAngelsText/en",
      "kabbalah/seventyTwoAngelsText/fr",
    ],
    description:
      "Lenain's entry on each of the seventy-two genii in full, in French and in English, loaded on demand.",
    page: "/kabbalah/yhvh/72angels",
  },
  "./kabbalah/seventyTwoAngels/derived": {
    sources: [],
    description:
      "What Lenain's four tables compute for each genius: its degrees of the zodiac, days of the year, minutes of the day, sign, planet and choir.",
    page: "/kabbalah/yhvh/72angels",
  },
  "./kabbalah/lenain/volume": {
    sources: ["kabbalah/lenain/pages"],
    description:
      "Lenain's La Science Cabalistique (1823) leaf by leaf, as printed.",
    page: "/books/la-science-cabalistique/texte-integral",
  },
  "./kabbalah/lenain/notes": {
    sources: ["kabbalah/lenain/apparatus"],
    description:
      "The editorial apparatus to Lenain's volume: corrections and notes, by leaf.",
    page: "/books/la-science-cabalistique",
  },
  "./kabbalah/lenain/pieces": {
    sources: [],
    description:
      "Lenain's text folded into paragraphs that run across leaves, by division of the book.",
    page: "/books/la-science-cabalistique",
  },
  "./kabbalah/lenain/firstTable": {
    sources: [],
    description:
      "Lenain's first table, reconstructed from the volume and the seventy-two.",
    page: "/books/la-science-cabalistique",
  },
  "./json/kabbalah/lenain/evidence.json": {
    sources: ["kabbalah/lenain/evidence"],
    description:
      "What each of Lenain's seventy-two entries says, as printed: the reading that the corrections to the seventy-two are checked against.",
    page: null,
  },
  "./astrology/kameas": {
    sources: [],
    description:
      "The planetary kameas, the magic squares from Saturn's 3 × 3 to the Moon's 9 × 9, computed rather than written out, and the constructions that make them.",
    page: null,
  },
};

/** What the manifest is made from. */
export interface ManifestInputs {
  schemas: Readonly<Record<TableName, GenericSchema>>;
  graph: Readonly<Record<TableName, TableSpec>>;
  /** Each table's source under `src/`, without `.json5`. */
  tableFiles: Readonly<Record<TableName, string>>;
  /** A table's rows, as parsed. */
  rowsOf: (table: TableName) => unknown;
  /** The bytes of a source's emitted JSON, by its name without `.json5`. */
  sizeOf: (source: string) => number;
  texts?: Readonly<Record<string, TextSpec>>;
}

/** The field manifest, from the schemas, the graph and the data. */
export function fieldManifest({
  schemas,
  graph,
  tableFiles,
  rowsOf,
  sizeOf,
  texts = TEXTS,
}: ManifestInputs): FieldManifest {
  const tables: Record<string, TableFields> = {};
  for (const table of Object.keys(tableFiles) as TableName[]) {
    const schema = schemas[table] as unknown as SchemaNode;
    const rows = rowsOf(table);
    const { steps } = unwrap(schema);
    const entry: TableFields = {
      subpath: `./${tableFiles[table]}`,
      source: `${tableFiles[table]}.json5`,
      shape: Array.isArray(rows) ? "array" : "object",
      rows: Array.isArray(rows)
        ? rows.length
        : Object.keys(rows as object).length,
      rowKey: rowKeyOf(table, schema, rows),
      rules: rulesOf(steps),
      fields: fieldsOf(schema, linksOf(graph[table])),
    };
    const description = descriptionOf(steps);
    tables[table] = description ? { description, ...entry } : entry;
  }

  const textEntries: Record<string, TextEntry> = {};
  for (const [subpath, { sources, description, page }] of Object.entries(texts))
    textEntries[subpath] = {
      sources: sources.map((source) => `${source}.json5`),
      size: sources.length
        ? sources.reduce((sum, source) => sum + sizeOf(source), 0)
        : null,
      description,
      page,
    };

  return { tables, texts: textEntries };
}
