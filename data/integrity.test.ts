import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLANET_IDS } from "./astrology/Planets";
import dictionary, { type EnochianDictionary } from "./enochian/Dictionary";
import type { TableSpec } from "./graphSpec";
import {
  checkDictionary,
  checkIntegrity,
  checkMirrors,
  type Failure,
} from "./integrity";
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

  it("counts a mirror the other table does not declare back", () => {
    // The graph on its own, before any data is walked: a `mirrors` that only
    // one side declares has `assemble()` assert symmetry in one direction,
    // and the data would pass. This used to run only under vitest; it is a
    // check now, so `pnpm data:check` and `pnpm build` reject it too.
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

    expect(checkMirrors(missing)).toEqual([]);
    expect(of("mirror", checkMirrors(oneWay))).toEqual([
      "sephirah.archangelId: mirrors archangel.sephirahId, which does not mirror it back",
    ]);
    expect(of("mirror", checkMirrors(crossed))).toEqual([
      "sephirah.archangelId: mirrors archangel.sephirahId, which does not mirror it back",
      "archangel.sephirahId: mirrors sephirah.gdGradeId, which does not mirror it back",
    ]);
  });

  it("names an array row by its id, then its no, then its index", () => {
    // The seventy-two are keyed `no` and carry no `id`, and their index is
    // one less than it, so an index sends a reader to the wrong entry.
    const angels = tables.seventyTwoAngel.map((angel, i) =>
      i === 3 ? { ...angel, wizardId: "gandalf" } : angel,
    );
    expect(of("undeclared", broken("seventyTwoAngel", angels))).toEqual([
      "seventyTwoAngel.4.wizardId: no link, pending target, external one or enumeration",
    ]);

    // The astrology houses carry neither, so the index is all there is.
    const houses = tables.house.map((house, i) =>
      i === 2 ? { ...house, wizardId: "gandalf" } : house,
    );
    expect(of("undeclared", broken("house", houses))).toEqual([
      "house.2.wizardId: no link, pending target, external one or enumeration",
    ]);

    // An `id` comes first, which is the key `assemble()` indexes by.
    const named = [
      { ...tables.seventyTwoAngel[0], id: "vehuiah", wizardId: "gandalf" },
    ];
    expect(of("undeclared", broken("seventyTwoAngel", named))).toEqual([
      "seventyTwoAngel.vehuiah.wizardId: no link, pending target, external one or enumeration",
    ]);
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

  it("counts a key one of the sources writes twice", () => {
    // The lint itself is [duplicateKeys.test.ts](./duplicateKeys.test.ts)'s;
    // this is its wiring into the check, which the real sources cannot
    // exercise because they are clean and have to stay so. The sources are
    // therefore read from a copy, with `amissio` put back the way `86895ad`
    // found it: the title JSON5 kept, and above it the one it had already
    // thrown away.
    const dir = mkdtempSync(join(tmpdir(), "magickli-sources-"));
    try {
      const source = readFileSync(
        new URL("./geomancy/tetragrams.json5", import.meta.url),
        "utf8",
      );
      const planted = source.replace(
        "\n  amissio: {\n",
        '\n  amissio: {\n    title: { en: "Loss" },\n',
      );
      expect(planted).not.toBe(source);
      mkdirSync(join(dir, "geomancy"));
      writeFileSync(join(dir, "geomancy", "tetragrams.json5"), planted);

      expect(of("duplicate", checkIntegrity(tables, dir))).toEqual([
        "geomancy/tetragrams.json5: amissio: title: written twice in one " +
          "object; JSON5 keeps the last silently",
      ]);
      // And the tables themselves are still clean, so nothing else moved.
      expect(of("duplicate", checkIntegrity())).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts a meaning or pronunciation an entry lists twice", () => {
    // The dictionary is no table, so this is the one check neither the
    // graph nor a schema has a part in. Seventy-seven entries did this
    // (plan 032, the dictionary after step 3): one object per row of the
    // sources, and a word EMPM prints once per gematria value came through
    // twice. A repeat that differs is two attestations and stays: ZON's
    // second "form" by its note, BIAB's second "stand" by its source.
    const { ZON, BIAB, APOPHRASZ } = dictionary;
    expect(ZON.meanings[1].meaning).toBe(ZON.meanings[0].meaning);
    expect(ZON.meanings[1].note).toBeDefined();
    expect(BIAB.meanings[1].meaning).toBe(BIAB.meanings[0].meaning);
    expect(BIAB.meanings[1].source).not.toBe(BIAB.meanings[0].source);
    expect(of("repeat", checkIntegrity())).toEqual([]);

    // Planted after the real objects: the meaning with its keys in the
    // other order, which is not a difference, and the pronunciation as it
    // stands. Through checkIntegrity(), since that is the wiring.
    const [meaning] = APOPHRASZ.meanings;
    const [sound] = APOPHRASZ.pronounciations;
    const repeat = (where: string, text: string, source: string) =>
      `${where}: ${JSON.stringify(text)} (${source}) a second time, identically`;
    const planted = {
      ...dictionary,
      APOPHRASZ: {
        ...APOPHRASZ,
        meanings: [
          ...APOPHRASZ.meanings,
          Object.fromEntries(
            Object.entries(meaning).reverse(),
          ) as typeof meaning,
        ],
        pronounciations: [...APOPHRASZ.pronounciations, sound],
      },
    };
    expect(of("repeat", checkIntegrity(tables, undefined, planted))).toEqual([
      repeat(
        `dictionary.APOPHRASZ.meanings.${APOPHRASZ.meanings.length}`,
        meaning.meaning,
        meaning.source,
      ),
      repeat(
        `dictionary.APOPHRASZ.pronounciations.${APOPHRASZ.pronounciations.length}`,
        sound.pronounciation,
        sound.source,
      ),
    ]);

    // A citation makes it another attestation.
    const cited = {
      ...dictionary,
      APOPHRASZ: {
        ...APOPHRASZ,
        meanings: [...APOPHRASZ.meanings, { ...meaning, source2: "Key 1" }],
      },
    };
    expect(of("repeat", checkDictionary(cited))).toEqual([]);

    // And a shape the dictionary's type forbids is said, not thrown at: the
    // dictionary has no schema, and check.ts is meant to list everything.
    const malformed = {
      ...dictionary,
      APOPHRASZ: {
        ...APOPHRASZ,
        meanings: [...APOPHRASZ.meanings, meaning.meaning],
        pronounciations: undefined,
      },
    } as unknown as EnochianDictionary;
    expect(of("schema", checkDictionary(malformed))).toEqual([
      `dictionary.APOPHRASZ.meanings.${APOPHRASZ.meanings.length}: not an object`,
      "dictionary.APOPHRASZ.pronounciations: not a list",
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
