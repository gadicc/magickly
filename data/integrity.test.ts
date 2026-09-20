import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANET_IDS } from "./astrology/Planets";
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
 * Half of these tests break the data on purpose to prove each one bites, and
 * the last two are about that command rather than the data: that it says
 * everything wrong at once, and that both builds run it.
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
      "kerub.earth.wizardId: no link, pending target, external one or enumeration",
    ]);
  });

  it("names the row an undeclared field is on, not only the table", () => {
    // Keter's row once spelled its key `archangelIdId` (`1cfdb0c`); the
    // table it hid in has eleven rows, and the seventy-two have seventy-two.
    // Two rows carry it here, and the first is the one named.
    const failures = broken("sephirah", {
      keter: tables.sephirah.keter,
      chochmah: { ...tables.sephirah.chochmah, archangelIdId: "ratziel" },
      binah: { ...tables.sephirah.binah, archangelIdId: "tzaphkiel" },
    });
    expect(of("undeclared", failures)).toEqual([
      "sephirah.chochmah.archangelIdId: no link, pending target, external one or enumeration",
    ]);
  });

  it("counts a field the graph names that no row has", () => {
    const failures = broken("gdDegree", { "1st": { id: "1st" } });
    expect(of("not-in-the-data", failures)).toEqual([
      "gdDegree.pillarId: declared, but no row has it",
    ]);
  });

  it("excuses an external field from that only where it is not id-shaped", () => {
    // `enochianLetter`'s two are "planet/element" and "tarot", which no rule
    // could find in the data; `tolPath.external["hermetic.tarotId"]` is
    // id-shaped, so a typo in it has to fail the same way a link would.
    const kept = broken("enochianLetter", {
      A: { id: "A", enochian: "un", title: "Un", english: "A" },
    });
    expect(of("not-in-the-data", kept)).toEqual([]);

    const noTarot = Object.fromEntries(
      Object.entries(tables.tolPath).map(([id, path]) => {
        const { hermetic, ...rest } = path as Record<string, unknown>;
        if (!hermetic) return [id, rest];
        const { tarotId, ...block } = hermetic as Record<string, unknown>;
        return [id, { ...rest, hermetic: block }];
      }),
    );
    expect(of("not-in-the-data", broken("tolPath", noTarot))).toEqual([
      "tolPath.hermetic.tarotId: declared, but no row has it",
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

  it("holds twelve planets and three spheres of the Tree", () => {
    const byKind = (kind: string) =>
      Object.entries(tables.planet)
        .filter(([, row]) => row.kind === kind)
        .map(([id]) => id);
    expect(byKind("planet")).toEqual([...PLANET_IDS]);
    expect(byKind("sphere")).toEqual([
      "primum-mobile",
      "zodiac",
      "olam-yesodot",
    ]);
  });

  it("counts a row PLANET_IDS and the data disagree about", () => {
    // The twelve are a list in TypeScript because a JSON import widens
    // `"planet"` to `string`, so `PlanetId` cannot be read off `kind`. This
    // check is the other direction, and it has to bite in both.
    const failures = broken("planet", {
      ...tables.planet,
      zodiac: { ...tables.planet.zodiac, kind: "planet" },
      ketu: { ...tables.planet.ketu, kind: "sphere" },
    });
    expect(of("derived", failures)).toEqual([
      'planet.zodiac: of kind "planet", and not in PLANET_IDS',
      'planet.ketu: of kind "sphere", and in PLANET_IDS',
    ]);

    const gone = { ...tables.planet } as Record<string, unknown>;
    delete gone.ketu;
    expect(of("derived", broken("planet", gone))).toEqual([
      "planet.ketu: in PLANET_IDS, and not a row of the table",
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

describe("pnpm data:check", () => {
  it("says everything that is wrong, not the first thing", () => {
    // What [check.ts](./check.ts) prints before it exits, and the reason it
    // collects rather than throws: one run is meant to be the whole list.
    const failures = broken("kerub", {
      earth: { id: "earth", zodiacId: ["taurus"], elementId: "quintessence" },
    });
    expect([...new Set(failures.map((f) => f.check))].sort()).toEqual([
      "arity",
      "link",
      "schema",
    ]);
  });

  it("runs before both of the builds that read the data", () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    for (const task of ["build", "check:turbopack"])
      expect(scripts[task]).toContain("pnpm data:check");
  });
});
