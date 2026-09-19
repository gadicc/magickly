import { describe, expect, it } from "vitest";
import distGraph from "./dist/graph.json";
import { graph } from "./graph";
import type { TableSpec } from "./graphSpec";
import { tables } from "./tables";

/**
 * The graph about itself: that it names every table, that what it leaves
 * empty is meant to be empty, that every `mirrors` is declared from both
 * ends, and that the `graph.json` the build emits is the same object.
 * Whether the data agrees with it — fields declared, links resolving, arity,
 * mirrors symmetric row by row, chains, schemas — is
 * [integrity.test.ts](./integrity.test.ts)'s question.
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

/**
 * Every `mirrors` that the table it names does not declare back: the target
 * must carry a link of that name, to this table, whose own `mirrors` is this
 * field. A one-sided declaration would make `assemble()` assert symmetry in
 * one direction only, so it is caught here, before any data is walked.
 */
function oneSidedMirrors(spec: Readonly<Record<string, TableSpec>>) {
  const wrong: string[] = [];
  for (const [name, table] of Object.entries(spec))
    for (const [field, link] of Object.entries(table.links ?? {})) {
      if (!link.mirrors) continue;
      const back = spec[link.to]?.links?.[link.mirrors];
      if (back?.to !== name || back.mirrors !== field)
        wrong.push(`${name}.${field} mirrors ${link.to}.${link.mirrors}`);
    }
  return wrong;
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

  it("declares every mirror on both sides", () => {
    const spec = graph as Readonly<Record<string, TableSpec>>;
    expect(oneSidedMirrors(spec)).toEqual([]);
  });

  it("catches a mirror the other table does not declare back", () => {
    const missing = {
      sephirah: { links: { archangelId: { to: "archangel" } } },
      archangel: { links: { sephirahId: { to: "sephirah" } } },
    } satisfies Record<string, TableSpec>;
    const oneWay = {
      sephirah: {
        links: { archangelId: { to: "archangel", mirrors: "sephirahId" } },
      },
      archangel: { links: { sephirahId: { to: "sephirah" } } },
    } satisfies Record<string, TableSpec>;
    const crossed = {
      sephirah: {
        links: { archangelId: { to: "archangel", mirrors: "sephirahId" } },
      },
      archangel: {
        links: { sephirahId: { to: "sephirah", mirrors: "gdGradeId" } },
      },
    } satisfies Record<string, TableSpec>;

    expect(oneSidedMirrors(missing)).toEqual([]);
    expect(oneSidedMirrors(oneWay)).toEqual([
      "sephirah.archangelId mirrors archangel.sephirahId",
    ]);
    expect(oneSidedMirrors(crossed)).toEqual([
      "sephirah.archangelId mirrors archangel.sephirahId",
      "archangel.sephirahId mirrors sephirah.gdGradeId",
    ]);
  });

  it("is emitted as graph.json, the same object", () => {
    expect(distGraph).toEqual(graph);
  });
});
