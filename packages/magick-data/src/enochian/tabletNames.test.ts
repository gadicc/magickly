import { describe, expect, it } from "vitest";
import elements from "../alchemy/Elements.ts";
import planets from "../astrology/Planets.ts";
import dictionary from "./Dictionary.ts";
import {
  type CitedName,
  DEE_CITED_NAMES,
  GD_CITED_NAMES,
} from "./fixtures/citedTabletNames.ts";
import {
  findTabletName,
  isTabletNameId,
  TABLET_NAME_IDS,
  TABLET_NAME_TRADITIONS,
  TABLET_QUARTER_ID_PREFIXES,
  TABLET_QUARTERS,
  type TabletName,
  type TabletQuarter,
  tabletNameSpellings,
  tabletNames,
  tabletNameVariants,
} from "./TabletNames.ts";
import tabletNotes, {
  attributionNote,
  citedSpellings,
  dictionarySpellings,
  nameRules,
  sourceUrl,
} from "./TabletNotes.ts";
import tablets, {
  type EnochianTabletID,
  type EnochianWatchtowerID,
  TABLET_VERSIONS,
  type TabletVersionId,
  tabletVersion,
  WATCHTOWER_IDS,
} from "./Tablets.ts";

/** A tablet in a version, which the test expects to exist. */
const view = (id: string, version: TabletVersionId = "gd") => {
  const found = tabletVersion(tablets[id as EnochianTabletID], version);
  if (!found) throw new Error(`no ${version} ${id}`);
  return found;
};

/** One name, which the test expects to exist. */
const nameOf = (
  id: EnochianTabletID,
  nameId: string,
  version: TabletVersionId = "gd",
): TabletName => {
  const found = findTabletName(view(id, version), nameId);
  if (!found) throw new Error(`no ${nameId} on ${version} ${id}`);
  return found;
};

/** A spelling folded for comparison: case, u for v, and no spaces. */
const fold = (spelling: string) =>
  spelling.toLowerCase().replaceAll("v", "u").replaceAll(" ", "");

const GD_VERSIONS: readonly TabletVersionId[] = TABLET_VERSIONS.filter(
  (version) => TABLET_NAME_TRADITIONS[version] === "gd",
);

/** The 38 names read off a Watchtower's letters alone, in every version. */
const own = (names: readonly TabletName[]) =>
  names.filter((name) => !name.unionLetter);

describe("tabletNames", () => {
  it("reads 38 names off each Watchtower, 58 with the Union's letters, with the same ids in every version", () => {
    // 58 a Watchtower's in the Golden Dawn's versions, then the Union's 5.
    expect(TABLET_NAME_IDS).toHaveLength(63);
    expect(new Set(TABLET_NAME_IDS).size).toBe(63);
    const watchtower = TABLET_NAME_IDS.slice(0, 58);
    for (const id of WATCHTOWER_IDS)
      for (const version of TABLET_VERSIONS) {
        const names = tabletNames(view(id, version));
        const golden = GD_VERSIONS.includes(version);
        expect(names.map((name) => name.id)).toEqual(
          golden
            ? watchtower
            : watchtower.filter((nameId) => !nameId.endsWith("archangel")),
        );
        const kinds: Record<string, number> = {};
        for (const name of names)
          kinds[name.kind] = (kinds[name.kind] ?? 0) + 1;
        expect(kinds).toEqual({
          holyName: 3,
          king: 1,
          senior: 6,
          crossColumn: 4,
          crossRow: 4,
          topRow: 4,
          servient: 16,
          ...(golden ? { kerubicArchangel: 4, servientArchangel: 16 } : {}),
        });
      }
    expect(TABLET_NAME_IDS.slice(58)).toEqual([
      "union-row-1",
      "union-row-2",
      "union-row-3",
      "union-row-4",
      "union-column-1",
    ]);
    expect(TABLET_NAME_IDS.slice(0, 10)).toEqual([
      "holy-1",
      "holy-2",
      "holy-3",
      "king",
      "senior-row-left",
      "senior-col6-up",
      "senior-col7-up",
      "senior-row-right",
      "senior-col6-down",
      "senior-col7-down",
    ]);
    expect(TABLET_NAME_IDS.slice(10, 22)).toEqual([
      "top-left-cross-column",
      "top-left-cross-row",
      "top-left-top-row",
      "top-left-servient-1",
      "top-left-servient-2",
      "top-left-servient-3",
      "top-left-servient-4",
      "top-left-kerubic-archangel",
      "top-left-servient-1-archangel",
      "top-left-servient-2-archangel",
      "top-left-servient-3-archangel",
      "top-left-servient-4-archangel",
    ]);
    expect(isTabletNameId("bottom-right-servient-4")).toBe(true);
    expect(isTabletNameId("bottom-right-servient-4-archangel")).toBe(true);
    expect(isTabletNameId("union-column-1")).toBe(true);
    expect(isTabletNameId("union-column-2")).toBe(false);
    expect(isTabletNameId("senior-row-up")).toBe(false);
  });

  it("reads each name along its squares, the quarters' names inside their quarter", () => {
    const origins: Record<TabletQuarter, [number, number]> = {
      topLeft: [0, 0],
      topRight: [0, 7],
      bottomLeft: [7, 0],
      bottomRight: [7, 7],
    };
    for (const name of tabletNames(view("earth"))) {
      expect(name.spelling).toBe(
        (name.unionLetter?.letter ?? "") +
          name.squares
            .map(({ row, column }) => view("earth").grid[row][column] ?? "?")
            .join(""),
      );
      if (!name.quarter) {
        expect(
          name.squares.every(
            ({ row, column }) => row === 6 || column === 5 || column === 6,
          ),
          name.id,
        ).toBe(true);
        continue;
      }
      const [top, left] = origins[name.quarter];
      for (const { row, column } of name.squares) {
        expect(row - top, name.id).toBeGreaterThanOrEqual(0);
        expect(row - top, name.id).toBeLessThan(6);
        expect(column - left, name.id).toBeGreaterThanOrEqual(0);
        expect(column - left, name.id).toBeLessThan(5);
      }
    }
    expect(TABLET_QUARTERS).toEqual([
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ]);
  });

  it("covers the tablet as the plan counts it", () => {
    // Of the 156 squares, 136 lie in one name, 16 in two and 2 in three;
    // the two centre squares lie in six (plan 090, Background).
    const count = new Map<number, number>();
    for (const name of own(tabletNames(view("air"))))
      for (const { row, column } of name.squares)
        count.set(row * 12 + column, (count.get(row * 12 + column) ?? 0) + 1);
    const histogram: Record<number, number> = {};
    for (const n of count.values()) histogram[n] = (histogram[n] ?? 0) + 1;
    expect(count.size).toBe(156);
    expect(histogram).toEqual({ 1: 136, 2: 16, 3: 2, 6: 2 });
    expect(count.get(6 * 12 + 5)).toBe(6);
    expect(count.get(6 * 12 + 6)).toBe(6);
  });

  it("reads the holy names on the seventh row", () => {
    const holy = (id: EnochianWatchtowerID) =>
      ["holy-1", "holy-2", "holy-3"].map((nameId) =>
        nameOf(id, nameId).spelling.toUpperCase(),
      );
    expect(holy("air")).toEqual(["ORO", "IBAH", "AOZPI"]);
    expect(holy("water")).toEqual(["MPH", "ARSL", "GAIOL"]);
    expect(holy("earth")).toEqual(["MOR", "DIAL", "HCTGA"]);
    expect(holy("fire")).toEqual(["OIP", "TEAA", "PDOCE"]);
  });

  it("reads the Golden Dawn's King in a whirl of eight squares", () => {
    const whirl = [
      [6, 4],
      [5, 5],
      [5, 6],
      [6, 7],
      [7, 6],
      [7, 5],
      [6, 5],
      [6, 6],
    ];
    for (const version of TABLET_VERSIONS)
      expect(
        nameOf("air", "king", version).squares.map(({ row, column }) => [
          row,
          column,
        ]),
      ).toEqual(whirl);
    expect(
      WATCHTOWER_IDS.map((id) => nameOf(id, "king").spelling.toUpperCase()),
    ).toEqual(["ICZHIHAL", "BATAIVAH", "RAAGIOSL", "EDLPRNAA"]);
    for (const version of GD_VERSIONS) {
      expect(nameOf("air", "king", version).spellings).toBeUndefined();
      expect(nameOf("air", "king", version).spelling).toHaveLength(8);
    }
  });

  it("reads Dee's and Raphael's King as six squares and either centre letter", () => {
    // Dee's record (Casaubon 1659, p.178): b, a, T, a, i, V, then A or H.
    const king = nameOf("air", "king", "dee");
    expect(
      king.squares
        .slice(0, 6)
        .map(({ row, column }) => view("air", "dee").grid[row][column]),
    ).toEqual(["b", "a", "T", "a", "i", "V"]);
    expect(king.squares.slice(6)).toEqual([
      { row: 6, column: 5 },
      { row: 6, column: 6 },
    ]);
    expect(king.spellings).toEqual(["baTaiVA", "baTaiVh"]);
    expect(king.spelling).toBe("baTaiVA");
    expect(nameOf("air", "king", "raphael").spellings).toEqual([
      "bataiva",
      "bataivh",
    ]);
    for (const id of WATCHTOWER_IDS)
      for (const version of ["dee", "raphael"] as const) {
        const { spellings, squares } = nameOf(id, "king", version);
        expect(spellings, `${version} ${id}`).toHaveLength(2);
        expect(spellings?.[0]).toHaveLength(7);
        for (const [index, spelling] of (spellings ?? []).entries())
          expect(spelling.at(-1)).toBe(
            view(id, version).grid[squares[6 + index].row][
              squares[6 + index].column
            ] ?? "?",
          );
      }
  });

  it("gives every version a tradition, the Golden Dawn's or Dee's", () => {
    // A record over every version: a new one must choose, or its King and
    // attributions would silently be the wrong tradition's.
    expect(Object.keys(TABLET_NAME_TRADITIONS).sort()).toEqual(
      [...TABLET_VERSIONS].sort(),
    );
    expect(TABLET_NAME_TRADITIONS).toEqual({
      gd: "gd",
      regardie: "gd",
      equinox: "gd",
      dee: "dee",
      raphael: "dee",
    });
  });

  it("names the quarters in the ids by their prefixes", () => {
    expect(TABLET_QUARTER_ID_PREFIXES).toEqual({
      topLeft: "top-left",
      topRight: "top-right",
      bottomLeft: "bottom-left",
      bottomRight: "bottom-right",
    });
    for (const name of tabletNames(view("air")))
      if (name.quarter)
        expect(
          name.id.startsWith(`${TABLET_QUARTER_ID_PREFIXES[name.quarter]}-`),
        ).toBe(true);
  });

  it("rotates the top rows in every version, the servient rows in the Golden Dawn's only", () => {
    expect(
      nameOf("air", "top-left-top-row").rotations?.map((each) =>
        each.toUpperCase(),
      ),
    ).toEqual(["RZLA", "ZLAR", "LARZ", "ARZL"]);
    expect(
      nameOf("water", "top-right-top-row").rotations?.map((each) =>
        each.toUpperCase(),
      ),
    ).toEqual(["TDIM", "DIMT", "IMTD", "MTDI"]);
    for (const version of TABLET_VERSIONS)
      for (const name of tabletNames(view("fire", version))) {
        // Dee's record rotates the four above each cross (Casaubon 1659,
        // p.178) and none below; the servient rotations are the Golden
        // Dawn's (Regardie 1940, vol. 4, pp.325-326).
        if (
          name.kind === "topRow" ||
          (name.kind === "servient" && GD_VERSIONS.includes(version)) ||
          name.unionLetter
        ) {
          expect(name.rotations, name.id).toHaveLength(4);
          expect(name.rotations?.[0]).toBe(name.spelling);
          for (const rotation of name.rotations ?? []) {
            expect([...rotation].sort()).toEqual([...name.spelling].sort());
            // The Union's letter stays first.
            if (name.unionLetter)
              expect(rotation[0]).toBe(name.unionLetter.letter);
          }
        } else expect(name.rotations, name.id).toBeUndefined();
      }
    // Earth of Fire's servient row, each square named by its rotation
    // (Regardie 1940, vol. 4, pp.325-326).
    expect(
      nameOf("fire", "bottom-left-servient-2").rotations?.map((each) =>
        each.toUpperCase(),
      ),
    ).toEqual(["DIOM", "IOMD", "OMDI", "MDIO"]);
  });

  it("shows Dee's two empty squares of Fire as gaps", () => {
    expect(nameOf("fire", "top-right-cross-row", "dee").spelling).toBe("oba?i");
    expect(nameOf("fire", "top-right-top-row", "dee").spelling).toBe("ana?");
    expect(nameOf("fire", "top-right-top-row", "dee").rotations).toEqual([
      "ana?",
      "na?a",
      "a?an",
      "?ana",
    ]);
    const gaps = WATCHTOWER_IDS.flatMap((id) =>
      TABLET_VERSIONS.flatMap((version) =>
        tabletNames(view(id, version))
          .filter((name) => name.spelling.includes("?"))
          .map((name) => `${version} ${id} ${name.id}`),
      ),
    );
    expect(gaps).toEqual([
      "dee fire top-right-cross-row",
      "dee fire top-right-top-row",
    ]);
    // The Golden Dawn's versions fill them, so its archangels have none.
  });

  it("gives the Golden Dawn's attributions in its versions only", () => {
    for (const version of TABLET_VERSIONS) {
      const names = tabletNames(view("water", version));
      const golden = GD_VERSIONS.includes(version);
      for (const name of names) {
        if (!golden || name.kind === "holyName" || name.kind === "unionColumn")
          expect(name.attribution, `${version} ${name.id}`).toBeUndefined();
        else expect(name.attribution, `${version} ${name.id}`).toBeDefined();
      }
    }
    const planet = (nameId: string) =>
      nameOf("earth", nameId).attribution?.planet;
    expect(
      [
        "king",
        "senior-row-left",
        "senior-row-right",
        "senior-col6-up",
        "senior-col6-down",
        "senior-col7-up",
        "senior-col7-down",
      ].map(planet),
    ).toEqual(["sol", "mars", "venus", "jupiter", "mercury", "luna", "saturn"]);
    for (const name of tabletNames(view("earth")))
      if (name.quarter)
        expect(name.attribution).toEqual({
          element: {
            topLeft: "air",
            topRight: "water",
            bottomLeft: "earth",
            bottomRight: "fire",
          }[name.quarter],
        });
    // The ids are the tables'.
    for (const name of tabletNames(view("earth"))) {
      const { element, planet: id } = name.attribution ?? {};
      if (element) expect(Object.hasOwn(elements, element)).toBe(true);
      if (id) expect(Object.hasOwn(planets, id)).toBe(true);
    }
  });

  it("reads the Tablet of Union's four lines and first column", () => {
    for (const version of GD_VERSIONS) {
      const names = tabletNames(view("union", version));
      expect(names.map((name) => [name.id, name.kind, name.spelling])).toEqual([
        ["union-row-1", "union", "EXARP"],
        ["union-row-2", "union", "HCOMA"],
        ["union-row-3", "union", "NANTA"],
        ["union-row-4", "union", "BITOM"],
        ["union-column-1", "unionColumn", "EHNB"],
      ]);
      expect(names.map((name) => name.attribution?.element)).toEqual([
        "air",
        "water",
        "earth",
        "fire",
        undefined,
      ]);
      for (const name of names) {
        expect(name.quarter).toBeUndefined();
        expect(name.rotations).toBeUndefined();
        expect(name.unionLetter).toBeUndefined();
      }
    }
    expect(nameOf("union", "union-column-1").squares).toEqual(
      [0, 1, 2, 3].map((row) => ({ row, column: 0 })),
    );
    // Dee's and Raphael's versions have no Tablet of Union.
    expect(tabletVersion(tablets.union, "dee")).toBeUndefined();
    expect(tabletNameVariants(tablets.union, "union-row-1")).toEqual([]);
    expect(tabletNameVariants(tablets.union, "king")).toEqual([]);
  });

  it("puts the Union's letters before the Kerubic and servient rows, in the Golden Dawn's versions", () => {
    // Regardie 1940, vol. 4, p.280: the first letter of the tablet's line
    // before each Kerubic name, the other four before the servient rows
    // by the quarter's element, in the order Air, Water, Earth, Fire.
    const line = {
      air: "EXARP",
      water: "HCOMA",
      earth: "NANTA",
      fire: "BITOM",
    };
    const order = { topLeft: 1, topRight: 2, bottomLeft: 3, bottomRight: 4 };
    for (const id of WATCHTOWER_IDS)
      for (const version of GD_VERSIONS)
        for (const name of tabletNames(view(id, version))) {
          if (!name.unionLetter) {
            expect(name.kind).not.toMatch(/Archangel$/);
            continue;
          }
          const column =
            name.kind === "kerubicArchangel"
              ? 0
              : order[name.quarter as TabletQuarter];
          expect(name.unionLetter).toEqual({
            letter: line[id][column],
            row: { air: 0, water: 1, earth: 2, fire: 3 }[id],
            column,
          });
          // The same squares as the row it is built on.
          const base = nameOf(
            id,
            name.id.replace(
              name.kind === "kerubicArchangel"
                ? "kerubic-archangel"
                : "-archangel",
              name.kind === "kerubicArchangel" ? "top-row" : "",
            ),
            version,
          );
          expect(name.squares).toEqual(base.squares);
          expect(name.spelling).toBe(name.unionLetter.letter + base.spelling);
          expect(name.quarter).toBe(base.quarter);
          expect(name.attribution).toEqual(base.attribution);
        }
    // Air of Air's archangel in its rotations, and Fire of Water's
    // servient rows with Water's Fire letter, as p.280 prints them.
    expect(
      nameOf("air", "top-left-kerubic-archangel").rotations?.map((each) =>
        each.toUpperCase(),
      ),
    ).toEqual(["ERZLA", "EZLAR", "ELARZ", "EARZL"]);
    expect(
      [1, 2, 3, 4].map((index) =>
        nameOf(
          "water",
          `bottom-right-servient-${index}-archangel`,
        ).spelling.toUpperCase(),
      ),
    ).toEqual(["AXPCN", "AVASA", "ADAPI", "ARNIL"]);
    // Earth's lower quarters, as the rule gives them on the Golden Dawn's
    // letters; the sources' spellings are cited (decision 8).
    expect(
      nameOf("earth", "bottom-left-kerubic-archangel").spelling.toUpperCase(),
    ).toBe("NRCNC");
    expect(
      nameOf("earth", "bottom-right-kerubic-archangel").spelling.toUpperCase(),
    ).toBe("NISMT");
    for (const version of ["dee", "raphael"] as const)
      expect(
        tabletNames(view("air", version)).filter((name) => name.unionLetter),
      ).toEqual([]);
  });

  it("is frozen and cached", () => {
    const names = tabletNames(view("air"));
    expect(tabletNames(view("air"))).toBe(names);
    expect(Object.isFrozen(names)).toBe(true);
    expect(Object.isFrozen(names[0])).toBe(true);
    expect(Object.isFrozen(names[0].squares)).toBe(true);
    expect(findTabletName(view("air"), "nonesuch")).toBeUndefined();
  });
});

describe("tabletNameVariants", () => {
  it("gives the other versions' whole readings, those that read alike together", () => {
    expect(tabletNameVariants(tablets.air, "king")).toEqual([
      {
        spelling: "baTaiVA",
        spellings: ["baTaiVA", "baTaiVh"],
        versions: ["dee", "raphael"],
      },
    ]);
    expect(tabletNameVariants(tablets.air, "king", "dee")).toEqual([
      { spelling: "baTaiVah", versions: ["gd", "regardie", "equinox"] },
    ]);
    expect(tabletNameVariants(tablets.air, "holy-1")).toEqual([]);
    expect(tabletNameVariants(tablets.air, "nonesuch")).toEqual([]);
    expect(
      tabletNameVariants(tablets.air, "king", "nonesuch" as never),
    ).toEqual([]);
    // Earth's top row of the bottom left quarter, where the eighth row
    // differs most.
    expect(tabletNameVariants(tablets.earth, "bottom-left-top-row")).toEqual([
      { spelling: "ROnc", versions: ["equinox"] },
      { spelling: "ROan", versions: ["dee"] },
      { spelling: "ocnc", versions: ["raphael"] },
    ]);
  });

  it("never mixes letters: each variant is one version's reading", () => {
    // The versions that have a name: the Union's letters are the Golden
    // Dawn's alone.
    const having = (id: EnochianTabletID, nameId: string) =>
      TABLET_VERSIONS.filter((each) => {
        const found = tabletVersion(tablets[id], each);
        return found && findTabletName(found, nameId);
      });
    for (const id of [...WATCHTOWER_IDS, "union"] as const)
      for (const version of TABLET_VERSIONS)
        for (const nameId of TABLET_NAME_IDS) {
          if (!having(id, nameId).includes(version)) {
            expect(tabletNameVariants(tablets[id], nameId, version)).toEqual(
              [],
            );
            continue;
          }
          const mine = nameOf(id, nameId, version);
          const variants = tabletNameVariants(tablets[id], nameId, version);
          const listed = variants.flatMap((variant) => variant.versions);
          expect(new Set(listed).size).toBe(listed.length);
          expect(listed).not.toContain(version);
          for (const variant of variants)
            for (const other of variant.versions) {
              const theirs = nameOf(id, nameId, other);
              expect(fold(theirs.spelling)).toBe(fold(variant.spelling));
              expect(
                fold(theirs.spelling) === fold(mine.spelling) &&
                  String(theirs.spellings?.map(fold)) ===
                    String(mine.spellings?.map(fold)),
              ).toBe(false);
            }
          for (const other of having(id, nameId))
            if (other !== version && !listed.includes(other))
              expect(
                fold(nameOf(id, nameId, other).spelling),
                `${id} ${nameId} ${version} ${other}`,
              ).toBe(fold(mine.spelling));
        }
  });
});

describe("the names' notes", () => {
  it("cite where every kind is read, in every version that reads it", () => {
    const kindsOf = (version: TabletVersionId) =>
      new Set(
        (["air", "union"] as const).flatMap((id) => {
          const found = tabletVersion(tablets[id], version);
          return found ? tabletNames(found).map((name) => name.kind) : [];
        }),
      );
    for (const version of TABLET_VERSIONS) {
      const kinds = kindsOf(version);
      expect(kinds.size, version).toBe(GD_VERSIONS.includes(version) ? 11 : 7);
      for (const kind of kinds) {
        const rules = nameRules(kind, version);
        expect(rules, `${kind} ${version}`).toHaveLength(1);
        expect(rules[0].sources.length).toBeGreaterThan(0);
        expect(rules[0].text.length).toBeGreaterThan(40);
        for (const source of rules[0].sources)
          expect(source.work).toMatch(
            GD_VERSIONS.includes(version)
              ? /^(regardie1940|regardie1939|equinox1912)$/
              : /^casaubon1659$/,
          );
      }
      // None for a kind the version does not read.
      for (const kind of ["kerubicArchangel", "union"])
        if (!kinds.has(kind as TabletName["kind"]))
          expect(nameRules(kind, version)).toEqual([]);
    }
    expect(nameRules("nonesuch", "gd")).toEqual([]);
    expect(nameRules("king", "nonesuch")).toEqual([]);
    expect(sourceUrl(nameRules("king", "dee")[0].sources[2])).toBe(
      "https://archive.org/details/truefaithfulrela00deej/page/n278",
    );
  });

  it("cite the Golden Dawn's attributions", () => {
    expect(attributionNote("planet")?.sources).toEqual([
      { work: "regardie1940", page: 278, leaf: 270 },
    ]);
    expect(attributionNote("element")?.sources.length).toBe(4);
    expect(attributionNote("nonesuch")).toBeUndefined();
  });

  it("give the cited spellings no version's path gives, each on its name", () => {
    const { cited } = tabletNotes.names;
    expect(cited.map((each) => each.spelling)).toEqual([
      "CABALPT",
      "LILACZA",
      "AOUVRRZ",
      "OBLGOTCA",
      "OSPMNIR",
      "UVOLBXDO",
      "NROAM",
      "NAAOM",
      "ALPHCTGA",
      "SAIINOR",
      "AAETPOI",
      "AISMT",
    ]);
    const union = view("union").grid;
    const unionRow = { air: 0, water: 1, earth: 2, fire: 3 } as const;
    for (const each of cited) {
      expect(isTabletNameId(each.id), each.spelling).toBe(true);
      expect(each.sources.length).toBeGreaterThan(0);
      expect(citedSpellings(each.tablet, each.id)).toContain(each);
      const tail = fold(each.spelling.slice(each.prefix?.length ?? 0));
      // No version's reading, nor any rotation of it, gives it.
      for (const version of TABLET_VERSIONS) {
        const name = findTabletName(view(each.tablet, version), each.id);
        if (!name) continue;
        const readings = [
          ...(name.rotations ?? []),
          ...(name.spellings ?? [name.spelling]),
        ].map(fold);
        if (each.reason !== "prefix")
          expect(readings, `${each.spelling} ${version}`).not.toContain(tail);
      }
      const gd = nameOf(each.tablet, each.id);
      // Filed where the source places it: the stage 0 list has the same
      // spelling on the same tablet, kind and quarter, with this reason.
      const placed = GD_CITED_NAMES.filter(
        (entry) =>
          entry.name === each.spelling &&
          entry.tablet === each.tablet &&
          entry.kind === gd.kind &&
          entry.quarter === gd.quarter,
      );
      expect(placed.length, each.spelling).toBeGreaterThan(0);
      for (const entry of placed)
        expect(entry.status, each.spelling).toBe(each.reason);
      // A prefix is a Kerubic archangel's, and every archangel's has one.
      expect(Boolean(each.prefix), each.spelling).toBe(
        gd.kind === "kerubicArchangel",
      );
      // What the Watchtower's own squares read, without a Union letter.
      const read = fold(gd.spelling.slice(gd.unionLetter ? 1 : 0));
      if (each.reason === "spelling")
        expect(
          editDistance(fold(each.spelling), fold(gd.spelling)),
          each.spelling,
        ).toBeLessThanOrEqual(2);
      const gdView = view(each.tablet);
      const lettersOf = (row: number, column: number) => [
        gdView.grid[row][column] ?? "",
        ...(gdView.marks.find(
          (mark) => mark.row === row && mark.column === column,
        )?.alt ?? []),
      ];
      if (each.reason === "doubledSquare") {
        // Both letters of each doubled square, in either order.
        let reads = [""];
        for (const { row, column } of gd.squares) {
          const doubled = each.squares?.some(
            (square) => square.row === row && square.column === column,
          );
          const letters = lettersOf(row, column);
          expect(letters.length, each.spelling).toBeGreaterThanOrEqual(
            doubled ? 2 : 1,
          );
          const options = doubled
            ? letters.flatMap((a) =>
                letters.filter((b) => b !== a).map((b) => a + b),
              )
            : [letters[0]];
          reads = reads.flatMap((read) =>
            options.map((option) => read + option),
          );
        }
        expect(reads.map(fold), each.spelling).toContain(fold(each.spelling));
      }
      if (each.reason === "secondLetters") {
        expect(each.prefix).toBe(union[unionRow[each.tablet]][0]);
        expect(each.prefix).toBe(gd.unionLetter?.letter);
        const letters = [...tail];
        const seconds = gd.squares.filter(({ row, column }, index) => {
          const all = lettersOf(row, column).map(fold);
          expect(all, each.spelling).toContain(letters[index]);
          return fold(gdView.grid[row][column] ?? "") !== letters[index];
        });
        expect(seconds.length, each.spelling).toBeGreaterThanOrEqual(3);
      }
      if (each.reason === "prefix") {
        expect(tail).toBe(read);
        expect(each.prefix).not.toBe(union[unionRow[each.tablet]][0]);
      }
    }
    expect(citedSpellings("air", "king")).toEqual([]);
    // Earth's two lower archangels: the rule's spellings and the cited ones
    // beside them (plan 090, decision 8).
    expect(
      citedSpellings("earth", "bottom-left-kerubic-archangel").map(
        (each) => each.spelling,
      ),
    ).toEqual(["NROAM"]);
    expect(
      citedSpellings("earth", "bottom-right-kerubic-archangel").map(
        (each) => each.spelling,
      ),
    ).toEqual(["NAAOM", "AISMT"]);
  });

  it("give the dictionary's own prefixes as the dictionary's", () => {
    // `WE`'s second spellings of the Kerubic archangels (plan 090,
    // decision 8): each a headword the dictionary calls a Kerubic
    // archangel, its Kerubic name some version's reading of that quarter's
    // top row, with a letter of the Union other than the rule's.
    const { text, spellings } = tabletNotes.names.dictionary;
    expect(text).toMatch(/Whole Enochian Dictionary/);
    expect(spellings).toHaveLength(12);
    const meanings = (word: string) =>
      (dictionary[word as keyof typeof dictionary]?.meanings ?? []).map(
        (each) => each.meaning,
      );
    /** Every version's reading of the top row an archangel is built on. */
    const kerubic = (id: EnochianWatchtowerID, nameId: string) =>
      tabletNameSpellings(
        tablets[id],
        nameId.replace("kerubic-archangel", "top-row"),
      ).map(fold);
    for (const each of spellings) {
      const gd = nameOf(each.tablet, each.id);
      expect(gd.kind, each.spelling).toBe("kerubicArchangel");
      expect(meanings(each.spelling).join(), each.spelling).toMatch(
        /Kerubic Archangel/,
      );
      expect(kerubic(each.tablet, each.id)).toContain(
        fold(each.spelling.slice(1)),
      );
      expect(each.spelling[0]).not.toBe(gd.unionLetter?.letter);
      expect(dictionarySpellings(each.tablet, each.id)).toContain(each);
      // No Golden Dawn source prints it.
      expect(
        GD_CITED_NAMES.filter((entry) => entry.name === each.spelling),
      ).toEqual([]);
    }
    // Every headword the dictionary calls a Kerubic archangel whose letter
    // is not the rule's, and whose Kerubic name a quarter reads, is listed.
    const listed = new Set(spellings.map((each) => each.spelling));
    for (const id of WATCHTOWER_IDS)
      for (const name of tabletNames(view(id)))
        if (name.kind === "kerubicArchangel")
          for (const [word] of Object.entries(dictionary))
            if (
              fold(word).length === 5 &&
              kerubic(id, name.id).includes(fold(word.slice(1))) &&
              word[0] !== name.unionLetter?.letter &&
              /Kerubic Archangel/.test(meanings(word).join())
            )
              expect(listed.has(word), word).toBe(true);
    expect(dictionarySpellings("air", "king")).toEqual([]);
  });
});

/** Levenshtein's distance between two words. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}

/** The union's letter rows and columns in a version, if it has the Union. */
function unionReadings(version: TabletVersionId): string[] {
  const union = tabletVersion(tablets.union, version);
  if (!union) return [];
  const rows = union.grid.map((row) => row.join(""));
  const columns = union.grid[0].map((_, column) =>
    union.grid.map((row) => row[column]).join(""),
  );
  return [...rows, ...columns].map(fold);
}

/**
 * Every reading a version's paths give for a cited name, by its tablet,
 * kind and quarter (plan 090, stage 0's comparison): the names'
 * spellings, their rotations, Dee's six-letter Seniors, a quarter's other
 * columns, the Union's rows and columns, and the Kerubic and servient
 * archangels, the names with the Union letter the Golden Dawn puts before
 * them (Regardie 1940, vol. 4, p.280), as `tabletNames` reads them.
 */
function readings(entry: CitedName, version: TabletVersionId): string[] {
  const { tablet, kind, quarter } = entry;
  if (!tablet || !kind) return [];
  if (tablet === "union") {
    // Every line and column of the Union, so that a column no rule reads
    // as a name would still be found; then the names the Union has.
    const own = tabletVersion(tablets.union, version);
    const names = own ? tabletNames(own) : [];
    return kind === "union" || kind === "unionColumn"
      ? [
          ...unionReadings(version),
          ...names
            .filter((name) => name.kind === kind)
            .map((name) => fold(name.spelling)),
        ]
      : [];
  }
  const own = tabletVersion(tablets[tablet], version);
  if (!own) return [];
  const names = tabletNames(own).filter(
    (name) => !quarter || !name.quarter || name.quarter === quarter,
  );
  const ofKind = (wanted: TabletName["kind"]) =>
    names.filter((name) => name.kind === wanted);
  const all = (list: readonly TabletName[]) =>
    list.flatMap((name) => [
      ...(name.spellings ?? [name.spelling]),
      ...(name.rotations ?? []),
    ]);
  let found: string[] = [];
  switch (kind) {
    case "holyName":
    case "king":
    case "crossColumn":
    case "crossRow":
    case "topRow":
    case "servient":
      found = all(ofKind(kind));
      break;
    case "senior":
      found = ofKind("senior").map((name) =>
        entry.reading === "sixLetters" ? name.spelling.slice(1) : name.spelling,
      );
      break;
    case "column": {
      const [top, left] = {
        topLeft: [0, 0],
        topRight: [0, 7],
        bottomLeft: [7, 0],
        bottomRight: [7, 7],
      }[quarter ?? "topLeft"];
      found = [0, 1, 3, 4].map((offset) =>
        own.grid
          .slice(top, top + 6)
          .map((row) => row[left + offset] ?? "?")
          .join(""),
      );
      break;
    }
    case "kerubicArchangel":
    case "servientArchangel":
      // The Golden Dawn's names with the Union's letters (vol. 4, p.280).
      found = quarter ? all(ofKind(kind)) : [];
      break;
  }
  return found.map(fold);
}

/** The versions whose paths give a cited name. */
const producedBy = (entry: CitedName) =>
  TABLET_VERSIONS.filter((version) =>
    readings(entry, version).includes(fold(entry.name)),
  );

const tally = (list: readonly CitedName[]) => {
  const counts: Record<string, number> = {};
  for (const { status } of list) counts[status] = (counts[status] ?? 0) + 1;
  return counts;
};

describe("the Golden Dawn's cited names (stage 0's lists)", () => {
  const paths = GD_CITED_NAMES.filter((entry) => entry.status === "path");

  it("are 221 names, each with its source, page and leaf", () => {
    expect(GD_CITED_NAMES).toHaveLength(221);
    expect(tally(GD_CITED_NAMES)).toEqual({
      path: 188,
      pronunciation: 16,
      notAName: 4,
      doubledSquare: 6,
      secondLetters: 2,
      spelling: 3,
      prefix: 1,
      misprint: 1,
    });
    for (const entry of GD_CITED_NAMES) {
      expect(tabletNotes.works[entry.source].archive?.item).toBe(entry.item);
      expect(entry.page).toMatch(/^\d+(-\d+)?$/);
      expect(entry.leaf).toBeGreaterThan(0);
    }
  });

  it("produce every name filed as a path, 181 of 188 by the Golden Dawn's letters", () => {
    const byGd = paths.filter((entry) => producedBy(entry).includes("gd"));
    const others = paths.filter((entry) => !producedBy(entry).includes("gd"));
    expect(paths).toHaveLength(188);
    expect(byGd).toHaveLength(181);
    // The other 7 by Dee's or the Equinox's letters.
    expect(
      others.map((entry) => `${entry.name} ${producedBy(entry).join(",")}`),
    ).toEqual([
      "AAOXAIF equinox,dee",
      "ICZHHCAL equinox",
      "SOAIZNT equinox",
      "LAOAZRP equinox",
      "TOILVR equinox",
      "INGM equinox",
      "LAOC equinox",
    ]);
  });

  it("leave 33 that no path gives: 20 not names of a path, 13 cited spellings or misprints", () => {
    const rest = GD_CITED_NAMES.filter((entry) => entry.status !== "path");
    expect(rest).toHaveLength(33);
    // None of them is read along any version's path.
    for (const entry of rest)
      expect(producedBy(entry), `${entry.name} ${entry.status}`).toEqual([]);
    // Pronunciations (vowelled names and examples of how to say one) and
    // the demons' roots.
    expect(
      rest.filter((entry) =>
        ["pronunciation", "notAName"].includes(entry.status),
      ),
    ).toHaveLength(20);
    // The cited spellings tabletNotes gives (12) and Liber Chanokh's
    // misprint OCAAD for OLAAD.
    const cited = rest.filter(
      (entry) => !["pronunciation", "notAName"].includes(entry.status),
    );
    expect(cited.map((entry) => entry.name).sort()).toEqual(
      [...tabletNotes.names.cited.map((each) => each.spelling), "OCAAD"].sort(),
    );
    // Every source's Earth of Water bar reads OLAAD.
    for (const version of TABLET_VERSIONS)
      expect(
        nameOf(
          "water",
          "bottom-left-cross-row",
          version,
        ).spelling.toUpperCase(),
      ).toBe("OLAAD");
  });
});

describe("Dee's cited names (stage 0's lists)", () => {
  const oro = DEE_CITED_NAMES.filter((entry) => entry.table === "ORO");

  it("are 67 names, 58 of ORO, each with its page and leaf", () => {
    expect(DEE_CITED_NAMES).toHaveLength(67);
    expect(oro).toHaveLength(58);
    expect(tally(DEE_CITED_NAMES)).toEqual({
      path: 36,
      pronunciation: 5,
      misprint: 7,
      earlyGuess: 3,
      blackCross: 9,
      backward: 2,
      notAName: 5,
    });
    for (const entry of DEE_CITED_NAMES) {
      expect(entry.source).toBe("casaubon1659");
      expect(entry.item).toBe("truefaithfulrela00deej");
      expect(entry.leaf).toBeGreaterThan(0);
    }
  });

  it("produce 36 of ORO's 58 by Dee's 1584 table, the rest each classified", () => {
    for (const entry of DEE_CITED_NAMES)
      if (entry.status !== "path")
        expect(producedBy(entry), `${entry.name} ${entry.status}`).toEqual([]);
    const byDee = oro.filter((entry) => producedBy(entry).includes("dee"));
    expect(byDee).toHaveLength(36);
    expect(byDee.every((entry) => entry.status === "path")).toBe(true);
    expect(tally(oro.filter((entry) => !byDee.includes(entry)))).toEqual({
      notAName: 1,
      pronunciation: 5,
      misprint: 7,
      earlyGuess: 3,
      blackCross: 4,
      backward: 2,
    });
    // By Raphael's of 1587: all but Npat, whose square the reform changed.
    const byRaphael = oro.filter((entry) =>
      producedBy(entry).includes("raphael"),
    );
    expect(byRaphael).toHaveLength(35);
    expect(
      byDee
        .filter((entry) => !byRaphael.includes(entry))
        .map((entry) => entry.name),
    ).toEqual(["Npat"]);
  });
});

describe("the names in the dictionary", () => {
  // Decides links only: every tablet role in the dictionary is from `WE`,
  // whose author and status are unknown (plan 090, decision 4). A change
  // in the data that loses a match fails here.
  const headwords = new Set(Object.keys(dictionary).map(fold));
  /** The names of a kind of a version's tablets that are headwords. */
  const count = (
    version: TabletVersionId,
    candidates: boolean,
    which: (name: TabletName) => boolean = (name) => !name.unionLetter,
    ids: readonly EnochianTabletID[] = WATCHTOWER_IDS,
  ) =>
    ids.flatMap((id) => {
      const found = tabletVersion(tablets[id], version);
      return (found ? tabletNames(found) : []).filter(
        (name) =>
          which(name) &&
          (candidates
            ? tabletNameSpellings(tablets[id], name.id, version)
            : (name.spellings ?? [name.spelling])
          ).some((spelling) => headwords.has(fold(spelling))),
      );
    }).length;
  const byVersion = (counted: (version: TabletVersionId) => number) =>
    Object.fromEntries(
      TABLET_VERSIONS.map((version) => [version, counted(version)]),
    );

  it("finds each version's names as headwords, case and u/v folded, pinned", () => {
    // The 38 names a Watchtower's letters give, 152 for the four: the
    // version's own spelling, and then with every version's reading as a
    // link would try them (`tabletNameSpellings`). The candidates are the
    // same readings whichever version leads, so the second count is the
    // same for all: every one of them has a headword.
    expect(byVersion((version) => count(version, false))).toEqual({
      gd: 140,
      regardie: 134,
      equinox: 131,
      dee: 135,
      raphael: 150,
    });
    expect(byVersion((version) => count(version, true))).toEqual({
      gd: 152,
      regardie: 152,
      equinox: 152,
      dee: 152,
      raphael: 152,
    });
  });

  it("finds the Union's names and the archangels, in the Golden Dawn's versions, pinned", () => {
    // Plan 090, stage 4. The dictionary has the Kerubic archangels (from
    // `WE`) but none of the servient rows with their Union letter.
    const kind = (wanted: TabletName["kind"]) => (name: TabletName) =>
      name.kind === wanted;
    expect(
      byVersion((version) => count(version, false, kind("kerubicArchangel"))),
    ).toEqual({ gd: 14, regardie: 14, equinox: 12, dee: 0, raphael: 0 });
    expect(
      byVersion((version) => count(version, true, kind("kerubicArchangel"))),
    ).toEqual({ gd: 14, regardie: 14, equinox: 14, dee: 0, raphael: 0 });
    expect(
      byVersion((version) => count(version, true, kind("servientArchangel"))),
    ).toEqual({ gd: 0, regardie: 0, equinox: 0, dee: 0, raphael: 0 });
    expect(
      byVersion((version) => count(version, false, () => true, ["union"])),
    ).toEqual({ gd: 4, regardie: 4, equinox: 4, dee: 0, raphael: 0 });
    // Not headwords: Earth's two lower archangels as the rule reads them
    // (the dictionary has NOCNC and NASMT, the sources NROAM, NAAOM and
    // AISMT), and the Union's column.
    expect(
      [...WATCHTOWER_IDS, "union" as const].flatMap((id) =>
        tabletNames(view(id))
          .filter(
            (name) =>
              (name.kind === "kerubicArchangel" || !name.quarter) &&
              !tabletNameSpellings(tablets[id], name.id).some((spelling) =>
                headwords.has(fold(spelling)),
              ),
          )
          .map((name) => name.spelling.toUpperCase()),
      ),
    ).toEqual(["NRCNC", "NISMT", "EHNB"]);
  });
});

describe("tabletNameSpellings", () => {
  it("gives the version's spelling first, then every other version's, unfolded", () => {
    expect(tabletNameSpellings(tablets.air, "king")).toEqual([
      "baTaiVah",
      "baTaiVAh",
      "baTaiVA",
      "baTaiVh",
      "bataiva",
      "bataivh",
    ]);
    expect(tabletNameSpellings(tablets.air, "king", "raphael")).toEqual([
      "bataiva",
      "bataivh",
      "baTaiVah",
      "baTaiVAh",
      "baTaiVA",
      "baTaiVh",
    ]);
    // Case and u/v are kept, where tabletNameVariants hides them.
    expect(tabletNameVariants(tablets.air, "holy-1")).toEqual([]);
    expect(tabletNameSpellings(tablets.air, "holy-2").length).toBeGreaterThan(
      1,
    );
    for (const id of [...WATCHTOWER_IDS, "union"] as const)
      for (const { id: nameId } of tabletNames(view(id))) {
        const all = tabletNameSpellings(tablets[id], nameId);
        expect(all[0]).toBe(nameOf(id, nameId).spelling);
        expect(new Set(all).size).toBe(all.length);
        for (const version of TABLET_VERSIONS) {
          const found = tabletVersion(tablets[id], version);
          const name = found && findTabletName(found, nameId);
          for (const spelling of name
            ? (name.spellings ?? [name.spelling])
            : [])
            expect(all).toContain(spelling);
        }
      }
    // The archangels are the Golden Dawn's versions' alone.
    expect(
      tabletNameSpellings(tablets.earth, "bottom-left-kerubic-archangel"),
    ).toEqual(["NRCnc", "NROnc"]);
    expect(
      tabletNameSpellings(
        tablets.earth,
        "bottom-left-kerubic-archangel",
        "dee",
      ),
    ).toEqual([]);
    expect(tabletNameSpellings(tablets.union, "king")).toEqual([]);
    expect(tabletNameSpellings(tablets.air, "nonesuch")).toEqual([]);
  });
});
