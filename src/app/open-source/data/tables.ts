import fields, { type Field, type TableFields } from "magick-data/fields";
import { type TableName, tables } from "magick-data/tables";
import { angelSlug } from "@/lib/angelSlugs";
import { gradePage, pathPage, planetPage, sephirahPage } from "@/seo/entities";

/**
 * What the data pages read from the field manifest (plan 080, decisions 4
 * and 6): the tables, their rows by key, the columns a table shows, and how
 * the tables link. The pages render from these and never from a field's
 * display string.
 */

/** Every table, in the order `magick-data/tables` names them. */
export const TABLE_NAMES = Object.keys(fields.tables) as TableName[];

export function isTableName(name: string): name is TableName {
  return Object.hasOwn(fields.tables, name);
}

export function tableFields(table: TableName): TableFields {
  return fields.tables[table];
}

/** A table's page. */
export const tablePath = (table: string) => `/open-source/data/${table}`;

/** A row's anchor on its table's page: its key, as the row's `id`. */
export const rowHref = (table: string, key: string) =>
  `${tablePath(table)}#${key}`;

/** A field's entry in its table's field list. */
export const fieldAnchor = (path: string) => `field-${path}`;

/** The name a raw table is imported as: its subpath's last part. */
export function importName(table: TableName) {
  return tableFields(table).subpath.split("/").at(-1) as string;
}

/** The line that imports a table's rows raw. */
export function importLine(table: TableName) {
  const { subpath } = tableFields(table);
  return `import ${importName(table)} from "magick-data/${subpath.slice(2)}";`;
}

/**
 * The line that imports a text: the whole module, whose exports differ
 * from text to text, or a JSON file that has no module, as JSON.
 */
export function textImportLine(subpath: string) {
  const specifier = `magick-data/${subpath.slice(2)}`;
  const name = (subpath.split("/").at(-1) as string).replace(/\.json$/, "");
  return subpath.endsWith(".json")
    ? `import ${name} from "${specifier}" with { type: "json" };`
    : `import * as ${name} from "${specifier}";`;
}

export type Row = Record<string, unknown>;

/** A table's rows with the key each is named by, in the file's order. */
export function rowsOf(table: TableName): [key: string, row: Row][] {
  const raw = tables[table] as unknown;
  const { rowKey } = tableFields(table);
  if (Array.isArray(raw))
    return (raw as Row[]).map((row) => [
      String(row["field" in rowKey ? rowKey.field : "id"]),
      row,
    ]);
  return Object.entries(raw as Record<string, Row>).map(([key, row]) => [
    "field" in rowKey ? String(row[rowKey.field]) : key,
    row,
  ]);
}

/** What names a table's rows, in words for its page. */
export function rowKeyLabel(table: TableName) {
  const { rowKey } = tableFields(table);
  return "field" in rowKey ? rowKey.field : "key";
}

/** The value at a field's path in a row; `undefined` where it has none. */
export function valueAt(row: Row, path: string): unknown {
  let value: unknown = row;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Row)[key];
  }
  return value;
}

/** A column of a table's rows: a field whose value fits a cell. */
export interface Column {
  field: Field;
  /** The object it is a key of, when it is one: the swatch's sibling. */
  parent?: Field;
}

/**
 * The columns a table shows (decision 4): each field whose value fits a
 * cell, and for an object, one column per key, or per key its `columns`
 * names; the rest of its keys, maps and arrays of objects are left to the
 * row's detail and the field list.
 */
export function columnsOf(table: TableName): Column[] {
  const list = tableFields(table).fields;
  const byPath = new Map(list.map((field) => [field.path, field]));
  const columns: Column[] = [];
  const visit = (field: Field, parent?: Field) => {
    const { type } = field;
    if (type.kind === "map") return;
    if (type.kind === "array" && type.of.kind === "object") return;
    if (type.kind !== "object") {
      columns.push({ field, parent });
      return;
    }
    for (const key of field.columns ?? type.keys) {
      const child = byPath.get(`${field.path}.${key}`);
      if (child) visit(child, field);
    }
  };
  for (const field of list) if (!/[.[]/.test(field.path)) visit(field);
  return columns;
}

/** The tables a table links to, and those that link to it. */
export function relationsOf(table: TableName) {
  const targets = (name: TableName) =>
    tableFields(name)
      .fields.filter((field) => field.link?.kind === "link")
      .map((field) => field.link?.to as TableName);
  const to = [...new Set(targets(table))].filter((name) => name !== table);
  const from = TABLE_NAMES.filter(
    (name) => name !== table && targets(name).includes(table),
  );
  return { to, from, self: targets(table).includes(table) };
}

/**
 * The page on the site for a row of a table that has them (decision 1):
 * the planets, the grades, the sephirot, the paths and the seventy-two.
 */
export function entityHref(table: TableName, key: string, row: Row) {
  switch (table) {
    case "planet":
      return planetPage(key)?.path;
    case "gdGrade":
      return gradePage(key)?.path;
    case "sephirah":
      return sephirahPage(key)?.path;
    case "treeOfLifePath":
      return pathPage(key)?.path;
    case "seventyTwoAngel":
      return `/kabbalah/angel/${angelSlug(Number(row.no))}`;
    default:
      return undefined;
  }
}

/** Bytes, as the page shows a text's size. */
export function size(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} kB`;
}
