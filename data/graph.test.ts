import { describe, expect, it } from "vitest";
import distGraph from "./dist/graph.json";
import { graph } from "./graph";
import type { TableSpec } from "./graphSpec";
import { tables } from "./tables";

/**
 * The graph about itself: that it names every table, that what it leaves
 * empty is meant to be empty, and that the `graph.json` the build emits is
 * the same object. Whether the data agrees with it — fields declared, links
 * resolving, arity, mirrors declared from both ends and symmetric row by
 * row, chains, schemas — is [integrity.test.ts](./integrity.test.ts)'s, and
 * lives in [integrity.ts](./integrity.ts) so that `pnpm data:check` asks it
 * too.
 */

/** Every field a table's spec accounts for, however it accounts for it. */
function declared(spec: TableSpec) {
  return [
    ...Object.keys(spec.links ?? {}),
    ...Object.keys(spec.pending ?? {}),
    ...Object.keys(spec.external ?? {}),
    ...Object.keys(spec.enum ?? {}),
  ];
}

describe("the graph", () => {
  it("names every table exactly once", () => {
    expect(Object.keys(graph)).toEqual(Object.keys(tables));
  });

  it("declares nothing at all for a table with no id-shaped field", () => {
    const bare = Object.entries(graph as Record<string, TableSpec>)
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

  it("is emitted as graph.json, the same object", () => {
    expect(distGraph).toEqual(graph);
  });
});
