/**
 * Whether the data says what [the graph](./graph.ts) says it says.
 *
 * A handful of questions, and a list of everything that answers wrongly: is
 * every id-shaped field declared, and is everything declared there; do the
 * links resolve; does the arity match; are the chains whole; does every row
 * pass its [schema](./schemas.ts); and do the few lists TypeScript has to
 * hold by hand still say what the data says? Nothing throws and nothing is
 * fatal here —
 * [integrity.test.ts](./integrity.test.ts) asserts the list is empty, and
 * [check.ts](./check.ts) is the same list on the command line, which
 * `pnpm build` runs before Next sees the data.
 *
 * The tables are an argument so that a test can hand it a broken one.
 */

import * as v from "valibot";
import { assemble, problemsOf } from "./assemble";
import { PLANET_IDS } from "./astrology/Planets";
import { graph } from "./graph";
import type { TableSpec } from "./graphSpec";
import { schemas } from "./schemas";
import { tables as realTables, type TableName, type Tables } from "./tables";

/** One thing that is wrong, named so a reader knows where to look. */
export interface Failure {
  /** Which question it failed. */
  check:
    | "undeclared"
    | "not-in-the-data"
    | "arity"
    | "link"
    | "chain"
    | "schema"
    /** A list written in TypeScript that the data no longer agrees with. */
    | "derived";
  /** `table`, `table.row` or `table.row.field`. */
  where: string;
  detail: string;
}

type Row = Record<string, unknown>;

const isIdField = (key: string) => key.endsWith("Id") || key.endsWith("Ids");

const plain = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A table's rows with their keys, an array table by `id` or by index. */
function rowsOf(table: unknown): Array<[string, Row]> {
  return Array.isArray(table)
    ? table.map((row, i) => [String((row as Row).id ?? i), row as Row])
    : Object.entries(table as Record<string, Row>);
}

/**
 * Every id-shaped field the rows carry, a nested one by its dotted path,
 * each against the first row that has it. A field with no `link` is reported
 * against that row, because "some row of this table" is not enough to find a
 * typo in a table of seventy-two.
 */
function idFields(table: unknown) {
  const found = new Map<string, string>();
  for (const [id, row] of rowsOf(table))
    for (const [key, value] of Object.entries(row)) {
      if (isIdField(key)) {
        if (!found.has(key)) found.set(key, id);
      } else if (plain(value))
        for (const nested of Object.keys(value as Row)) {
          const path = `${key}.${nested}`;
          if (isIdField(nested) && !found.has(path)) found.set(path, id);
        }
    }
  return found;
}

/** Every field a table's spec accounts for, however it accounts for it. */
function declaredFields(spec: TableSpec) {
  return [
    ...Object.keys(spec.links ?? {}),
    ...Object.keys(spec.pending ?? {}),
    ...Object.keys(spec.external ?? {}),
    ...Object.keys(spec.enum ?? {}),
  ];
}

/** The value at a dotted path, or `undefined` where the block is absent. */
function at(row: Row, field: string): unknown {
  const dot = field.lastIndexOf(".");
  if (dot === -1) return row[field];
  const holder = row[field.slice(0, dot)];
  return plain(holder) ? (holder as Row)[field.slice(dot + 1)] : undefined;
}

/**
 * A `nextId`/`prevId` pair: a link to the row's own table whose mirror is
 * another such link back. The chain must have one head, one tail, and reach
 * every row that is in it exactly once.
 */
function checkChain(
  name: string,
  forward: string,
  back: string,
  table: unknown,
) {
  const failures: Failure[] = [];
  const rows = rowsOf(table);
  const chained = rows.filter(([, row]) => at(row, forward) || at(row, back));
  const ends = (field: string) => chained.filter(([, row]) => !at(row, field));

  for (const [end, field] of [
    ["head", back],
    ["tail", forward],
  ] as const)
    if (ends(field).length !== 1)
      failures.push({
        check: "chain",
        where: name,
        detail: `${ends(field).length} rows have no ${field}, not one ${end}`,
      });
  if (failures.length) return failures;

  const byId = new Map(rows);
  const visited: string[] = [];
  let id: string | undefined = ends(back)[0][0];
  while (id && !visited.includes(id)) {
    visited.push(id);
    id = at(byId.get(id) as Row, forward) as string | undefined;
  }
  if (visited.length !== chained.length)
    failures.push({
      check: "chain",
      where: name,
      detail: `the walk along ${forward} reaches ${visited.length} of ${chained.length} rows`,
    });
  return failures;
}

/**
 * [`PLANET_IDS`](./astrology/Planets.ts) against the table it names: the rows
 * of kind `"planet"`, exactly, in both directions. The list is written out
 * because a JSON import widens `"planet"` to `string`, so the twelve cannot
 * be an `Extract` over the field the way they would be off an `as const`
 * module; this is the half of the guarantee the type system cannot give
 * (plan 032, decision 14).
 */
function checkPlanetIds(table: unknown): Failure[] {
  const failures: Failure[] = [];
  const listed = new Set<string>(PLANET_IDS);
  const rows = new Map(rowsOf(table));

  for (const [id, row] of rows)
    if ((row.kind === "planet") !== listed.has(id))
      failures.push({
        check: "derived",
        where: `planet.${id}`,
        detail:
          row.kind === "planet"
            ? 'of kind "planet", and not in PLANET_IDS'
            : `of kind ${JSON.stringify(row.kind)}, and in PLANET_IDS`,
      });

  for (const id of listed)
    if (!rows.has(id))
      failures.push({
        check: "derived",
        where: `planet.${id}`,
        detail: "in PLANET_IDS, and not a row of the table",
      });

  return failures;
}

/** Everything wrong with the data, as the graph and the schemas see it. */
export function checkIntegrity(input: Tables = realTables): Failure[] {
  const failures: Failure[] = [];
  const names = Object.keys(input) as TableName[];

  for (const name of names) {
    const spec = graph[name] as TableSpec;
    const table = input[name];
    const declared = declaredFields(spec);
    const fields = idFields(table);

    for (const [field, row] of fields)
      if (!declared.includes(field))
        failures.push({
          check: "undeclared",
          where: `${name}.${row}.${field}`,
          detail: "no link, pending target, external one or enumeration",
        });

    // An `external` field is exempt only where it is not id-shaped, which is
    // how the two polymorphic Enochian ones ("planet/element", "tarot") are
    // parked. An id-shaped one must still be in the data, so that a typo in
    // `tolPath.external["hermetic.tarotId"]` fails here rather than sitting
    // in the graph naming nothing.
    const external = Object.keys(spec.external ?? {});
    for (const field of declared)
      if (
        !fields.has(field) &&
        !(external.includes(field) && !isIdField(field))
      )
        failures.push({
          check: "not-in-the-data",
          where: `${name}.${field}`,
          detail: "declared, but no row has it",
        });

    for (const [field, link] of Object.entries(spec.links ?? {}))
      for (const [id, row] of rowsOf(table)) {
        const value = at(row, field);
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) !== Boolean(link.many))
          failures.push({
            check: "arity",
            where: `${name}.${id}.${field}`,
            detail: link.many
              ? "a plural field whose value is not a list"
              : "a singular field whose value is a list",
          });
      }

    for (const [field, link] of Object.entries(spec.links ?? {}))
      if (link.to === name && link.mirrors && field < link.mirrors)
        failures.push(...checkChain(name, field, link.mirrors, table));

    const schema = schemas[name];
    for (const [id, row] of rowsOf(table)) {
      const result = v.safeParse(schema, row);
      for (const issue of result.issues ?? [])
        failures.push({
          check: "schema",
          where: `${name}.${id}${issue.path ? `.${issue.path.map((p) => String(p.key)).join(".")}` : ""}`,
          detail: issue.message,
        });
    }
  }

  failures.push(...checkPlanetIds(input.planet));

  // Everything assembling the tables found: an id no row is keyed by, a
  // mirror that does not point back, a back-link two rows claim, and an
  // accessor that would have shadowed a field of the row.
  for (const problem of problemsOf(assemble(input)))
    failures.push({
      check: "link",
      where: `${problem.table}.${problem.row}.${problem.field}`,
      detail: `${problem.kind}: ${problem.detail}`,
    });

  return failures;
}
