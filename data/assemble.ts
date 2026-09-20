/**
 * Joins tables into plain rows that carry their links.
 *
 * Eager, scoped and non-mutating: the caller names the tables it wants, gets
 * a clone of each row with every declared accessor on it, and the sources are
 * untouched. The rows are ordinary objects with enumerable properties, so
 * they cross the Server → Client boundary, `Object.keys` shows the links and
 * dot-prop paths such as `gdGrade.planet.symbol` work unchanged. Lazy getters
 * were tried and rejected: a non-enumerable one is dropped silently by Flight
 * in production (plan 032, alternatives).
 *
 * Nothing throws. A link that does not resolve, an accessor that would shadow
 * a field, an asymmetric mirror and a back-link that is not unique are
 * collected as [problems](#Problem) and read back with `problemsOf`, which is
 * what [the integrity check](./integrity.test.ts) asserts on. Importing bad
 * data must fail a test, not a page.
 */
import { graph } from "./graph";
import type { LinkSpec, TableSpec } from "./graphSpec";
import type { TableName, Tables } from "./tables";
import type { Assembled } from "./types";

/** What the data says that the graph says it should not. */
export interface Problem {
  kind:
    | "dangling"
    | "inverse-not-unique"
    | "accessor-collision"
    | "mirror-asymmetric";
  /** The table the row is in. */
  table: string;
  /** The row's key, or its index where the table is an array. */
  row: string;
  /** The field, as the graph names it. */
  field: string;
  /** What is wrong, in a sentence. */
  detail: string;
}

type AnyRow = Record<string, unknown>;
type RawTable = Record<string, AnyRow> | AnyRow[];

/** The graph as the runtime walks it, where a table name is only a string. */
const spec = graph as Readonly<Record<string, TableSpec>>;

interface Built {
  /** The sources this was built from, so a different table of the same name rebuilds. */
  sources: Record<string, unknown>;
  data: Record<string, RawTable>;
  problems: Problem[];
}

const cache = new Map<string, Built>();
const problemsByData = new WeakMap<object, Problem[]>();

/**
 * The accessor a link takes: `as` if it names one, else the field name
 * without its suffix, pluralised for a list.
 */
function accessorName(field: string, link: LinkSpec) {
  if (link.as) return link.as;
  const leaf = field.slice(field.lastIndexOf(".") + 1);
  return leaf.endsWith("Ids") ? `${leaf.slice(0, -3)}s` : leaf.slice(0, -2);
}

/** A dotted field as its containing object and the key inside it. */
function splitPath(field: string): [string | null, string] {
  const dot = field.lastIndexOf(".");
  return dot === -1
    ? [null, field]
    : [field.slice(0, dot), field.slice(dot + 1)];
}

/** Where a nested accessor lands, or `null` where the row has no such block. */
function holderOf(row: AnyRow, prefix: string | null) {
  if (prefix === null) return row;
  const holder = row[prefix];
  return holder && typeof holder === "object" ? (holder as AnyRow) : null;
}

/** Freezes the whole graph, cycles included. */
function deepFreeze(value: unknown, seen: WeakSet<object>) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
}

function build(input: Record<string, RawTable>, names: string[]): Built {
  const problems: Problem[] = [];
  const problem = (
    kind: Problem["kind"],
    table: string,
    row: string,
    field: string,
    detail: string,
  ) => problems.push({ kind, table, row, field, detail });

  // Every row cloned once, keyed the way the table keys it: an object table
  // by its own key, an array table by `id` where its rows carry one.
  const rows: Record<string, Array<[string, AnyRow]>> = {};
  const index: Record<string, Map<string, AnyRow>> = {};
  const data: Record<string, RawTable> = {};

  // The tables keep the order the caller named them in; only the walk below
  // is sorted, so that what it reports does not depend on that order.
  for (const name of Object.keys(input)) {
    const table = input[name];
    const entries: Array<[string, AnyRow]> = Array.isArray(table)
      ? table.map((row, i) => [String(row.id ?? i), structuredClone(row)])
      : Object.entries(table).map(([id, row]) => [id, structuredClone(row)]);
    rows[name] = entries;
    index[name] = new Map(entries);
    data[name] = Array.isArray(table)
      ? entries.map(([, row]) => row)
      : Object.fromEntries(entries);
  }

  /** Assigns an accessor, unless the row already has a field of that name. */
  const attach = (
    holder: AnyRow,
    accessor: string,
    value: unknown,
    table: string,
    row: string,
    field: string,
  ) => {
    if (Object.hasOwn(holder, accessor)) {
      problem(
        "accessor-collision",
        table,
        row,
        field,
        `${accessor} is already a field of the row`,
      );
      return false;
    }
    holder[accessor] = value;
    return true;
  };

  for (const name of names) {
    for (const [field, link] of Object.entries(spec[name]?.links ?? {})) {
      if (!names.includes(link.to)) continue;
      const accessor = accessorName(field, link);
      const [prefix, leaf] = splitPath(field);
      const target = index[link.to];

      for (const [id, row] of rows[name]) {
        const holder = holderOf(row, prefix);
        if (!holder) continue;
        const value = Object.hasOwn(holder, leaf) ? holder[leaf] : undefined;

        const resolve = (wanted: unknown) => {
          const found = target.get(String(wanted));
          if (!found)
            problem(
              "dangling",
              name,
              id,
              field,
              `no ${link.to} is keyed ${JSON.stringify(wanted)}`,
            );
          else if (link.mirrors && found[link.mirrors] !== id)
            problem(
              "mirror-asymmetric",
              name,
              id,
              field,
              `${link.to}.${String(wanted)}.${link.mirrors} is ` +
                `${JSON.stringify(found[link.mirrors])}, not ${JSON.stringify(id)}`,
            );
          return found;
        };

        if (link.many)
          attach(
            holder,
            accessor,
            // A list the data does not have stays undefined, and a value that
            // is not one is the arity check's to report.
            Array.isArray(value)
              ? value.map(resolve).filter((found) => found !== undefined)
              : undefined,
            name,
            id,
            field,
          );
        else
          attach(
            holder,
            accessor,
            value === null || value === undefined ? undefined : resolve(value),
            name,
            id,
            field,
          );
      }
    }
  }

  // Back-links, after every link, so that an inverse shadowing an accessor is
  // caught too. Every row of the target gets one, empty where nothing points.
  for (const name of names) {
    for (const [field, link] of Object.entries(spec[name]?.links ?? {})) {
      if (!link.inverse || !names.includes(link.to)) continue;
      const [prefix, leaf] = splitPath(field);
      const ours = new Set<AnyRow>();

      for (const [id, row] of rows[link.to])
        if (
          attach(
            row,
            link.inverse,
            link.inverseMany ? [] : undefined,
            link.to,
            id,
            field,
          )
        )
          ours.add(row);

      for (const [id, row] of rows[name]) {
        const holder = holderOf(row, prefix);
        const value =
          holder && Object.hasOwn(holder, leaf) ? holder[leaf] : undefined;
        const wanted = link.many
          ? Array.isArray(value)
            ? value
            : []
          : value === null || value === undefined
            ? []
            : [value];

        for (const one of wanted) {
          const found = index[link.to].get(String(one));
          if (!found || !ours.has(found)) continue;
          if (link.inverseMany) (found[link.inverse] as AnyRow[]).push(row);
          else if (found[link.inverse] === undefined) found[link.inverse] = row;
          else
            problem(
              "inverse-not-unique",
              link.to,
              String(one),
              link.inverse,
              `more than one ${name} names it, ${JSON.stringify(id)} among them`,
            );
        }
      }
    }
  }

  deepFreeze(data, new WeakSet());
  return { sources: { ...input }, data, problems };
}

/**
 * The given tables, joined. Calling it twice with the same tables returns the
 * same object, so identity is stable and the work is done once.
 */
export function assemble(tables: Tables): Assembled<"*">;
export function assemble<K extends TableName>(
  tables: Pick<Tables, K>,
): Assembled<K>;
// The implementation says only "an object of tables", because what it builds
// is mutable until the freeze at the end while what the overloads promise is
// `readonly` through and through, and a `readonly` array is assignable to
// neither of the shapes this one holds.
export function assemble(
  tables: Record<string, unknown>,
): Record<string, unknown> {
  const input = tables as Record<string, RawTable>;
  const names = Object.keys(input).sort();
  const key = names.join(",");

  const already = cache.get(key);
  if (already && names.every((name) => already.sources[name] === input[name]))
    return already.data;

  const built = build(input, names);
  cache.set(key, built);
  problemsByData.set(built.data, built.problems);
  return built.data;
}

/** What was wrong with the data an assembled object was built from. */
export function problemsOf(assembled: object): Problem[] {
  return problemsByData.get(assembled) ?? [];
}
