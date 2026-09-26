/**
 * Whether the data says what [the graph](./graph.ts) says it says.
 *
 * A handful of questions, and a list of everything that answers wrongly: is
 * every id-shaped field declared, and is everything declared there; is every
 * `mirrors` declared from both ends; do the links resolve; does the arity
 * match; are the chains whole; does each path's id spell the two spheres it
 * joins; does every row pass its [schema](./schemas.ts); do the few lists
 * TypeScript has to hold by hand still say what the data says; does any
 * source [write a key twice](./duplicateKeys.ts); and does the Enochian
 * dictionary, which is no table, hold an entry its type does not admit, or
 * list a meaning or pronunciation twice? Nothing throws and nothing is fatal
 * here — [integrity.test.ts](./integrity.test.ts) asserts the list is empty,
 * and [check.ts](./check.ts) is the same list on the command line, which
 * `pnpm build` runs before Next sees the data.
 *
 * The tables are an argument so that a test can hand it a broken one.
 */

import * as v from "valibot";
import { assemble, problemsOf } from "./assemble";
import { PLANET_IDS } from "./astrology/Planets";
import { duplicateKeysInSources } from "./duplicateKeys";
import realDictionary, { type EnochianDictionary } from "./enochian/Dictionary";
import { graph } from "./graph";
import type { TableSpec } from "./graphSpec";
import { enochianEntry, schemas } from "./schemas";
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
    /** A path whose id does not spell the indices of the spheres it names. */
    | "ends"
    | "schema"
    /** A `mirrors` the graph declares from one end only. */
    | "mirror"
    /** A key written twice in one object of a JSON5 source. */
    | "duplicate"
    /** An object one entry of the Enochian dictionary lists twice. */
    | "repeat"
    /** A list written in TypeScript that the data no longer agrees with. */
    | "derived";
  /**
   * `table`, `table.row` or `table.row.field`; for a source, its file and
   * the path within it; for the dictionary, the word and the path within
   * its entry.
   */
  where: string;
  detail: string;
}

type Row = Record<string, unknown>;

const isIdField = (key: string) => key.endsWith("Id") || key.endsWith("Ids");

const plain = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Where a schema issue is, dotted and led by a dot; empty at the root. */
const dotted = (issue: v.BaseIssue<unknown>) =>
  issue.path ? `.${issue.path.map((p) => String(p.key)).join(".")}` : "";

/**
 * A table's rows with the name a failure should call them by: an object
 * table's key, and for an array table the row's own `id`, or its `no`, or
 * failing both its index. The seventy-two carry `no` and no `id`, and their
 * index is one less than it, which would send a reader to the wrong entry.
 */
function rowsOf(table: unknown): Array<[string, Row]> {
  return Array.isArray(table)
    ? table.map((row, i) => [
        String((row as Row).id ?? (row as Row).no ?? i),
        row as Row,
      ])
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
 * A path's id against the two sephirot it names: `1_6` is Keter to Tiferet,
 * by their `index`, in the order `fromId` and `toId` give them. The id is
 * what the Tree draws and every URL carries, and the pair says the same thing
 * in words, so the two must not drift. An end that names no sephirah is the
 * link check's to report, and is passed over here.
 */
function checkPathEnds(paths: unknown, sephirot: unknown): Failure[] {
  const failures: Failure[] = [];
  const index = new Map(rowsOf(sephirot).map(([id, row]) => [id, row.index]));

  for (const [id, row] of rowsOf(paths)) {
    const from = index.get(String(row.fromId));
    const to = index.get(String(row.toId));
    if (from === undefined || to === undefined) continue;
    const spelled = `${from}_${to}`;
    if (id !== spelled)
      failures.push({
        check: "ends",
        where: `tolPath.${id}`,
        detail: `names ${row.fromId} and ${row.toId}, which spell ${spelled}`,
      });
  }
  return failures;
}

/**
 * Every `mirrors` the table it names does not declare back: the target must
 * carry a link of that name, to this table, whose own `mirrors` is this
 * field. A one-sided declaration would have `assemble()` assert symmetry in
 * one direction only, and the data would pass; it is caught here, before any
 * data is walked, so that `pnpm data:check` rejects it as the test suite does.
 *
 * The spec is an argument because this is the one check with no data in it,
 * and a test has to hand it a graph that is wrong.
 */
export function checkMirrors(
  spec: Readonly<Record<string, TableSpec>> = graph,
): Failure[] {
  const failures: Failure[] = [];
  for (const [name, table] of Object.entries(spec))
    for (const [field, link] of Object.entries(table.links ?? {})) {
      if (!link.mirrors) continue;
      const back = spec[link.to]?.links?.[link.mirrors];
      if (back?.to !== name || back.mirrors !== field)
        failures.push({
          check: "mirror",
          where: `${name}.${field}`,
          detail: `mirrors ${link.to}.${link.mirrors}, which does not mirror it back`,
        });
    }
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

/**
 * The Enochian dictionary against its type, and against itself. The
 * dictionary is no table, so the graph never reads it; every entry is held
 * to [its schema](./schemas.ts) here, since the type is written by hand and
 * the module emitted, and nothing else would notice a number where a string
 * should be. And a meaning or pronunciation an entry lists twice,
 * identically, is a repeat: the file was typed one row of its sources at a
 * time, and a word EMPM prints once per gematria value came through as two
 * objects saying the same thing, which `/enochian/dictionary` printed twice
 * (plan 032, follow-ups). Two objects that differ in anything — the source,
 * its citation, a note — are two attestations, and stay.
 *
 * The dictionary is an argument so that a test can hand it a repeat. The
 * real one is the module [the build](./build.mts) emits, as the tables are
 * the JSON it emits: what ships is what is checked.
 */
export function checkDictionary(
  dictionary: EnochianDictionary = realDictionary,
): Failure[] {
  const failures: Failure[] = [];
  for (const [word, entry] of Object.entries(dictionary)) {
    const result = v.safeParse(enochianEntry, entry);
    for (const issue of result.issues ?? [])
      failures.push({
        check: "schema",
        where: `dictionary.${word}${dotted(issue)}`,
        detail: issue.message,
      });

    // An entry that is no object, a list that is no list, an item that is no
    // object: the schema has just said so, and it is passed over here rather
    // than thrown at.
    if (!plain(entry)) continue;
    for (const list of ["meanings", "pronounciations"] as const) {
      const items: unknown = entry[list];
      if (!Array.isArray(items)) continue;
      const seen = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        const item: unknown = items[i];
        if (!plain(item)) continue;
        // The order the keys were written in is not a difference; anything
        // else, at any depth, is.
        const written = JSON.stringify(
          Object.fromEntries(Object.entries(item).sort()),
        );
        if (seen.has(written)) {
          const text = "meaning" in item ? item.meaning : item.pronounciation;
          failures.push({
            check: "repeat",
            where: `dictionary.${word}.${list}.${i}`,
            detail: `${JSON.stringify(text)} (${item.source}) a second time, identically`,
          });
        }
        seen.add(written);
      }
    }
  }
  return failures;
}

/**
 * Everything wrong with the data, as the graph and the schemas see it.
 *
 * `sources` is where the duplicate-key lint reads the JSON5 from, and is
 * `data/` unless a test says otherwise; the real sources are clean, so a
 * planted one is the only way that branch is ever walked
 * ([integrity.test.ts](./integrity.test.ts)). The default lives in
 * [duplicateKeys.ts](./duplicateKeys.ts), which is where the directory is
 * known. `dictionary` is the same arrangement for the one source that is no
 * table: the emitted module unless a test hands one over.
 */
export function checkIntegrity(
  input: Tables = realTables,
  sources?: string,
  dictionary?: EnochianDictionary,
): Failure[] {
  const failures: Failure[] = checkMirrors();
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
          where: `${name}.${id}${dotted(issue)}`,
          detail: issue.message,
        });
    }
  }

  failures.push(...checkPlanetIds(input.planet));
  failures.push(...checkPathEnds(input.tolPath, input.sephirah));

  // The sources as text, which is the only place a repeated key is visible:
  // JSON5 keeps the last of them, so everything downstream sees one.
  for (const { file, path, key } of duplicateKeysInSources(sources))
    failures.push({
      check: "duplicate",
      where: `${file}: ${path ? `${path}: ` : ""}${key}`,
      detail: "written twice in one object; JSON5 keeps the last silently",
    });

  // The one source that is no table, which nothing above reaches.
  failures.push(...checkDictionary(dictionary));

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
