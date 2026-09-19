import { describe, expect, it } from "vitest";
import { checkIntegrity, type Failure } from "./integrity";
import { type Tables, tables } from "./tables";

/**
 * The data against the graph: every id-shaped field declared, every link
 * resolving, the arity as named, the mirrors symmetric, the chains whole, no
 * accessor shadowing a field, and every row through its schema. This replaces
 * the step-0 audit, which walked the barrel's mutation and listed the links
 * it could not make; plan 032's step 1 emptied that list and step 2 makes the
 * question a real one. Whether the graph names every table, and matches the
 * `graph.json` the build emits, is [graph.test.ts](./graph.test.ts)'s.
 *
 * The checks live in [integrity.ts](./integrity.ts) so that
 * [check.ts](./check.ts) can run them from the command line before a build.
 * Half of these tests break the data on purpose to prove each one bites.
 */

/** The real tables with one of them replaced by something wrong. */
const broken = (name: keyof Tables, table: unknown) =>
  checkIntegrity({ ...tables, [name]: table } as Tables);

const of = (check: Failure["check"], failures: Failure[]) =>
  failures
    .filter((f) => f.check === check)
    .map((f) => `${f.where}: ${f.detail}`);

describe("the data against the graph", () => {
  it("has nothing wrong with it", () => {
    expect(checkIntegrity()).toEqual([]);
  });

  it("counts an id-shaped field the graph does not name", () => {
    const failures = broken("kerub", {
      earth: {
        id: "earth",
        zodiacId: "taurus",
        elementId: "earth",
        wizardId: "gandalf",
      },
    });
    expect(of("undeclared", failures)).toEqual([
      "kerub.wizardId: no link, pending target, external one or enumeration",
    ]);
  });

  it("counts a field the graph names that no row has", () => {
    const failures = broken("gdDegree", { "1st": { id: "1st" } });
    expect(of("not-in-the-data", failures)).toEqual([
      "gdDegree.pillarId: declared, but no row has it",
    ]);
  });

  it("counts a list where the graph says one, and one where it says a list", () => {
    const failures = broken("kerub", {
      earth: { id: "earth", zodiacId: ["taurus"], elementId: "earth" },
    });
    expect(of("arity", failures)).toEqual([
      "kerub.earth.zodiacId: a singular field whose value is a list",
    ]);
    const plural = broken("tetragram", {
      via: {
        ...tables.tetragram.via,
        planetIds: "luna",
        rulerIds: ["taphthartharath"],
      },
    });
    expect(of("arity", plural)).toEqual([
      "tetragram.via.planetIds: a plural field whose value is not a list",
    ]);
  });

  it("counts an id no row is keyed by", () => {
    const failures = broken("kerub", {
      earth: { id: "earth", zodiacId: "taurus", elementId: "quintessence" },
    });
    expect(of("link", failures)).toEqual([
      'kerub.earth.elementId: dangling: no element is keyed "quintessence"',
    ]);
  });

  it("counts a mirror that does not point back", () => {
    const failures = broken("elemental", {
      ...tables.elemental,
      gnome: { ...tables.elemental.gnome, elementId: "air" },
    });
    expect(of("link", failures)).toContain(
      'element.earth.elementalId: mirror-asymmetric: elemental.gnome.elementId is "air", not "earth"',
    );
  });

  it("counts a chain with two heads, or one that does not reach every row", () => {
    const headless = broken("gdGrade", {
      ...tables.gdGrade,
      "2=9": { ...tables.gdGrade["2=9"], prevId: undefined },
    });
    expect(of("chain", headless)).toEqual([
      "gdGrade: 2 rows have no prevId, not one head",
    ]);
  });

  it("counts a row its schema rejects", () => {
    const failures = broken("soul", {
      guph: {
        id: "guph",
        name: { en: "body", he: "גוף", roman: "guph" },
        extra: true,
      },
    });
    expect(of("schema", failures)).toEqual([
      'soul.guph.extra: Invalid key: Expected never but received "extra"',
    ]);
  });

  it("leaves only Da'at outside a chain", () => {
    // Folded in from the chain walk that came with step 1: the check itself
    // proves each chain whole, and this says which rows are not in one.
    const loose = (table: Record<string, object>) =>
      Object.entries(table)
        .filter(
          ([, row]) =>
            !Object.hasOwn(row, "nextId") && !Object.hasOwn(row, "prevId"),
        )
        .map(([id]) => id);
    expect(loose(tables.sephirah)).toEqual(["daat"]);
    expect(loose(tables.gdGrade)).toEqual([]);
    expect(loose(tables.tolPath)).toEqual([]);
  });

  it("allows a field named after a table, which is not an accessor", () => {
    // `alchemySymbol` and `alchemyTerm` rows carry a numeric `gdGrade`, which
    // is the name a `gdGradeId` link would take. Neither table has such a
    // link, so nothing collides: the check is about accessors, not names.
    expect(tables.alchemySymbol.sulphur.gdGrade).toBe(1);
    expect(tables.alchemyTerm.king.gdGrade).toBe(1);
    expect(checkIntegrity()).toEqual([]);
  });
});
