/**
 * Where a dotted field path ends up, without a row to read it from.
 *
 * `readFieldPath(sephirah, "gdGrade.planet.symbol")` is the runtime half, and
 * it stays dot-prop (plan 032, decision 8). This is the static half: given a
 * table and the same path, walk [the graph](./graph.ts) — hopping through a
 * declared link wherever a segment is a link's accessor, including one
 * declared inside a nested block such as `hermetic.hebrewLetterId` — and say
 * which table and which field the path lands on, or `undefined` where it
 * lands nowhere.
 *
 * These paths are a public contract. They arrive from query strings
 * (`?field=`), from the ritual documents, from the study sets and from the
 * render contracts, and nothing before this could tell whether one still
 * resolved short of rendering the component that reads it. A test can now
 * assert every one of them, so a data edit or a graph change that breaks a
 * path fails the suite instead of blanking a label.
 *
 * A segment that is not a link accessor must be a field some row of the
 * current table actually has, which is why this reads the tables as well as
 * the graph: the graph declares only the id-shaped fields, and a path's last
 * hop is almost always an ordinary one. The sources are injectable so a test
 * can walk a table it makes up; the default is every table, raw, so importing
 * this module brings the data with it — it is a build-time and test-time
 * helper, not something a page should reach for.
 *
 * A `*` segment reads every element of a list, as
 * [readFieldPath](../../../src/components/kabbalah/fieldPath.ts) does
 * (plan 039, decision 4): it is valid only directly after a list, a `many`
 * link's accessor or a list-valued field, and the walk carries on inside the
 * elements. What such a path reads is one joined string, so its target is
 * never `many`.
 */
import { accessorName } from "./assemble.ts";
import { graph } from "./graph.ts";
import type { LinkSpec } from "./graphSpec.ts";
import { type TableName, tables } from "./tables.ts";

/** Where a path ends. */
export interface PathTarget {
  /** The table the last hop landed in. */
  table: TableName;
  /** The field inside that table's row, or `null` where the path is the row. */
  field: string | null;
  /**
   * Whether the value is a list, because the last hop was a `many` link and
   * no `*` on the way joined it into one string.
   */
  many: boolean;
}

/** A table's rows as a list, however the table holds them. */
type AnyRow = Record<string, unknown>;

/** The segment that reads every element of a list. */
const EVERY = "*";
type RawTable = Readonly<Record<string, unknown>> | readonly unknown[];

const spec = graph as Readonly<
  Record<string, { links?: Readonly<Record<string, LinkSpec>> }>
>;

/** The link `T` declares at `prefix` whose accessor is `accessor`, if any. */
function linkAt(table: string, prefix: string, accessor: string) {
  for (const [field, link] of Object.entries(spec[table]?.links ?? {})) {
    const dot = field.lastIndexOf(".");
    const at = dot === -1 ? "" : field.slice(0, dot);
    if (at === prefix && accessorName(field, link) === accessor) return link;
  }
  return undefined;
}

/** The back-link some table declares onto `T` under this accessor, if any. */
function inverseAt(table: string, prefix: string, accessor: string) {
  if (prefix !== "") return undefined;
  for (const [source, entry] of Object.entries(spec))
    for (const link of Object.values(entry.links ?? {}))
      if (link.to === table && link.inverse === accessor)
        return { to: source as TableName, many: link.inverseMany === true };
  return undefined;
}

function rowsOf(table: RawTable): unknown[] {
  return Array.isArray(table) ? [...table] : Object.values(table);
}

/**
 * Whether `value` carries the chain of keys, where a `*` is any element of a
 * list and must stand on one.
 */
function carries(value: unknown, keys: readonly string[]): boolean {
  if (keys.length === 0) return true;
  const [key, ...rest] = keys;
  if (key === EVERY)
    return (
      Array.isArray(value) &&
      (rest.length === 0 || value.some((element) => carries(element, rest)))
    );
  if (!value || typeof value !== "object") return false;
  if (!Object.hasOwn(value, key)) return false;
  return carries((value as AnyRow)[key], rest);
}

/** Whether any row of the table carries the whole chain of keys. */
function fieldExists(table: RawTable, path: string) {
  const keys = path.split(".");
  return rowsOf(table).some((row) => carries(row, keys));
}

/**
 * The table and field `path` reaches from `table`, or `undefined` if some
 * segment is neither a declared link's accessor nor a field of the data.
 *
 * A list link is walked through with an index — `planets.0.symbol` — as
 * dot-prop reads it, or with `*` — `planets.*.symbol` — as `readFieldPath`
 * reads every element; a path that ends on the list itself is a target of its
 * own, with `many`.
 */
export function pathTarget(
  table: TableName,
  path: string,
  sources: Readonly<Record<string, RawTable>> = tables,
): PathTarget | undefined {
  let at: TableName = table;
  let prefix = "";
  let many = false;
  // A `*` on the way joins whatever follows into one string.
  let joined = false;
  const segments = path.split(".");
  // One `*` per path, as readFieldPath reads it: each multiplies the work.
  if (segments.filter((segment) => segment === EVERY).length > 1)
    return undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment || !sources[at]) return undefined;

    const link = linkAt(at, prefix, segment);
    const inverse = link
      ? { to: link.to, many: link.many === true }
      : inverseAt(at, prefix, segment);
    if (inverse) {
      if (!sources[inverse.to]) return undefined;
      at = inverse.to;
      prefix = "";
      many = inverse.many;
      // A list is read through an index, as dot-prop reads it, or through
      // `*`, as readFieldPath reads every element of it.
      if (many && i + 1 < segments.length) {
        const index = segments[i + 1];
        if (index === EVERY) joined = true;
        else if (!/^\d+$/.test(index)) return undefined;
        i++;
        many = false;
      }
      continue;
    }

    // A `*` here follows a field rather than a link; `fieldExists` holds it
    // to a list. At the start of a path it would follow the row, which is not
    // one.
    if (segment === EVERY) {
      if (prefix === "") return undefined;
      joined = true;
    }
    const next = prefix ? `${prefix}.${segment}` : segment;
    if (!fieldExists(sources[at], next)) return undefined;
    prefix = next;
    many = false;
  }

  // Through `*`, a path must end on a field: the elements are joined as
  // text, and a row or a list joined as text reads "[object Object]".
  if (joined && prefix === "") return undefined;
  return {
    table: at,
    field: prefix === "" ? null : prefix,
    many: many && !joined,
  };
}

export default pathTarget;
