import { describe, expect, it } from "vitest";
import distGraph from "./dist/graph.json";
import { graph } from "./graph";
import type { TableSpec } from "./graphSpec";
import { tables } from "./tables";

/**
 * The graph is only as good as its inventory. These tests ask whether it
 * describes the data it claims to: whether every id-shaped field in every
 * table is classified, and whether everything classified is really there.
 * Whether the data then satisfies what is declared — links resolving, arity,
 * mirrors, inverses — is [integrity.test.ts](./integrity.test.ts)'s question.
 */

type Row = Record<string, unknown>;

const rowsOf = (table: unknown) =>
  (Array.isArray(table) ? table : Object.values(table as object)) as Row[];

const isIdField = (key: string) => key.endsWith("Id") || key.endsWith("Ids");

const plain = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Every id-shaped field a table's rows carry, as the graph would name it: a
 * nested one by its full dotted path. One level deep, which is what the
 * format expresses and what the data has.
 */
function idFields(table: unknown) {
  const found = new Set<string>();
  for (const row of rowsOf(table)) {
    for (const [key, value] of Object.entries(row)) {
      if (isIdField(key)) found.add(key);
      else if (plain(value))
        for (const nested of Object.keys(value as Row))
          if (isIdField(nested)) found.add(`${key}.${nested}`);
    }
  }
  return [...found].sort();
}

/** Every field the graph accounts for, however it accounts for it. */
function declared(spec: TableSpec) {
  return [
    ...Object.keys(spec.links ?? {}),
    ...Object.keys(spec.pending ?? {}),
    ...Object.keys(spec.external ?? {}),
    ...Object.keys(spec.enum ?? {}),
  ].sort();
}

const specs = Object.entries(graph) as [keyof typeof graph, TableSpec][];

describe("the graph", () => {
  it("names every table exactly once", () => {
    expect(Object.keys(graph)).toEqual(Object.keys(tables));
  });

  it.each(specs)("accounts for every id-shaped field of %s", (name, spec) => {
    const fields = idFields(tables[name]);
    const undeclared = fields.filter((f) => !declared(spec).includes(f));
    expect(undeclared).toEqual([]);
  });

  it.each(specs)("declares nothing %s does not have", (name, spec) => {
    const fields = idFields(tables[name]);
    // `external` may name a field that is not id-shaped, which is how the
    // polymorphic Enochian ones are parked; the rest must be in the data.
    const external = Object.keys(spec.external ?? {});
    const absent = declared(spec).filter(
      (f) => !fields.includes(f) && !external.includes(f),
    );
    expect(absent).toEqual([]);
  });

  it("declares nothing at all for a table with no id-shaped field", () => {
    const bare = specs
      .filter(([, spec]) => declared(spec).length === 0)
      .map(([name]) => name);
    expect(bare).toEqual([
      "hebrewLetter",
      "enochianTablet",
      "geomanicHouse",
      "angelicOrder",
      "christianChoir",
      "fourWorlds",
      "godName",
      "soul",
      "tribeOfIsrael",
      "seventyTwoAngel",
      "chakra",
      "alchemyTerm",
    ]);
  });

  it("is emitted as graph.json, byte for byte the same object", () => {
    expect(distGraph).toEqual(graph);
  });
});
