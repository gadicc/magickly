import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { schemas } from "../schemas.ts";
import tablets, {
  DEFAULT_TABLET_VERSION,
  type EnochianTablet,
  type EnochianTabletID,
  readingLetters,
  readingMark,
  TABLET_SOURCES,
  TABLET_VERSION_RULES,
  TABLET_VERSIONS,
  type TabletVersionId,
  type TabletView,
  tabletDifferences,
  tabletReading,
  tabletVersion,
  versionSource,
  WATCHTOWER_IDS,
} from "./Tablets.ts";

const schema = schemas.enochianTablet;

/** `rows` × `columns` squares, every one `letter`. */
const filled = (rows: number, columns: number, letter = "a") =>
  Array.from({ length: rows }, () => letter.repeat(columns));

const issues = (row: unknown) =>
  v.safeParse(schema, row).issues?.map((issue) => issue.message) ?? [];

/** A tablet in a version, which the test expects to exist. */
const view = (id: EnochianTabletID, version: TabletVersionId = "gd") => {
  const found = tabletVersion(tablets[id], version);
  if (!found) throw new Error(`no ${version} ${id}`);
  return found;
};

/** A view's rows as strings, an empty square as ".". */
const lines = (tablet: TabletView) =>
  tablet.grid.map((row) => row.map((letter) => letter ?? ".").join(""));

/** A version's mark on a square. */
const markOf = (tablet: TabletView, row: number, column: number) =>
  tablet.marks.find((mark) => mark.row === row && mark.column === column);

describe("the tablet schema", () => {
  it("holds every row", () => {
    for (const row of Object.values(tablets) as EnochianTablet[])
      expect([row.id, issues(row)]).toEqual([row.id, []]);
  });

  it("gives a Watchtower 13 rows of 12 and the Tablet of Union 4 of 5", () => {
    const shape =
      "a Watchtower's reading is 13 rows of 12 squares, the Tablet of Union's 4 rows of 5";
    const watchtower = (rows: string[]) => ({
      id: "w",
      kind: "watchtower",
      readings: { greer: { rows } },
    });
    const union = (rows: string[]) => ({
      id: "u",
      kind: "union",
      readings: { greer: { rows } },
    });
    expect(issues(watchtower(filled(13, 12)))).toEqual([]);
    expect(issues(union(filled(4, 5)))).toEqual([]);
    expect(issues(watchtower(filled(4, 5)))).toEqual([shape]);
    expect(issues(union(filled(13, 12)))).toEqual([shape]);
    const ragged = filled(13, 12);
    ragged[6] = ragged[6].slice(1);
    expect(issues(watchtower(ragged))).toEqual([shape]);
  });

  it("takes letters or empty squares, known sources and a reading", () => {
    const union = (readings: unknown) => ({ id: "u", kind: "union", readings });
    expect(issues(union({ dee1584: { rows: filled(4, 5, ".") } }))).toEqual([]);
    for (const letter of ["1", "é", " ", "-"])
      expect(
        issues(union({ greer: { rows: filled(4, 5, letter) } })),
      ).not.toEqual([]);
    expect(issues(union({ nonesuch: { rows: filled(4, 5) } }))).not.toEqual([]);
    expect(issues(union({}))).toEqual(["a tablet has at least one reading"]);
    expect(issues({ id: "u", readings: { greer: filled(4, 5) } })).not.toEqual(
      [],
    );
  });

  it("marks a square of the grid once, saying something of it", () => {
    const row = (marks: unknown) => ({
      id: "u",
      kind: "union",
      readings: { greer: { rows: filled(4, 5), marks } },
    });
    const message =
      "a mark names a square of the grid once, and says something of it";
    expect(
      issues(
        row([
          { row: 0, column: 0, below: ["b"] },
          { row: 3, column: 4, reversed: true },
          { row: 1, column: 2, beside: ["b"], below: ["c", "d"] },
          { row: 2, column: 0, dictated: ["c"], doubt: "medium" },
          { row: 2, column: 1, misprint: "o" },
          { row: 2, column: 2, alt: ["p"], doubt: "high" },
        ]),
      ),
    ).toEqual([]);
    for (const marks of [
      [{ row: 4, column: 0, below: ["b"] }],
      [{ row: 0, column: 5, below: ["b"] }],
      [{ row: 0, column: 0 }],
      [{ row: 0, column: 0, alt: [] }],
      [{ row: 0, column: 0, reversed: false }],
      [{ row: 0, column: 0, reversed: false, below: [] }],
      [
        { row: 0, column: 0, below: ["b"] },
        { row: 0, column: 0, reversed: true },
      ],
    ])
      expect(issues(row(marks))).toEqual([message]);
    for (const marks of [
      [{ row: -1, column: 0, below: ["b"] }],
      [{ row: 0.5, column: 0, below: ["b"] }],
      [{ row: 0, column: 0, below: ["bc"] }],
      [{ row: 0, column: 0, doubt: "some" }],
      [{ row: 0, column: 0, below: ["b"], colour: "red" }],
    ])
      expect(issues(row(marks))).not.toEqual([]);
  });

  it("chooses only letters of readings the tablet has, not Regardie's own", () => {
    const empty = filled(4, 5);
    empty[3] = "aaaa.";
    const row = (gd: unknown) => ({
      id: "u",
      kind: "union",
      readings: {
        regardie1940: { rows: filled(4, 5) },
        greer: { rows: filled(4, 5, "b") },
        equinox1912: { rows: filled(4, 5) },
        dee1584: { rows: empty },
      },
      choices: { gd },
    });
    expect(issues(row([{ row: 3, column: 4, from: "greer" }]))).toEqual([]);
    const message =
      "a choice names a letter of a reading the tablet has, other than Regardie's";
    for (const choice of [
      { row: 3, column: 4, from: "raphael1587" },
      { row: 4, column: 0, from: "greer" },
      { row: 3, column: 4, from: "dee1584" },
      { row: 0, column: 0, from: "equinox1912" },
    ])
      expect(issues(row([choice])), JSON.stringify(choice)).toEqual([message]);
    expect(issues(row([{ row: 0, column: 0, from: "nonesuch" }]))).not.toEqual(
      [],
    );
  });

  it("lists the sources the code does", () => {
    const keys = new Set(
      (Object.values(tablets) as EnochianTablet[]).flatMap((tablet) =>
        Object.keys(tablet.readings),
      ),
    );
    expect([...keys].sort()).toEqual([...TABLET_SOURCES].sort());
    expect(Object.isFrozen(TABLET_SOURCES)).toBe(true);
    expect(Object.isFrozen(TABLET_VERSIONS)).toBe(true);
  });
});

describe("the Watchtowers' ids", () => {
  it("are every Watchtower, frozen, and nothing else", () => {
    expect(Object.isFrozen(WATCHTOWER_IDS)).toBe(true);
    const watchtowers = (Object.keys(tablets) as EnochianTabletID[]).filter(
      (id) => tablets[id].kind === "watchtower",
    );
    expect([...WATCHTOWER_IDS].sort()).toEqual(watchtowers.sort());
    for (const id of WATCHTOWER_IDS) expect(tablets[id].id).toBe(id);
  });
});

describe("a tablet's versions", () => {
  it("default to the Golden Dawn's", () => {
    expect(DEFAULT_TABLET_VERSION).toBe("gd");
    expect(tabletVersion(tablets.air)).toBe(view("air", "gd"));
  });

  it("rest on frozen rows and rules", () => {
    expect(Object.isFrozen(tablets.fire)).toBe(true);
    expect(Object.isFrozen(tablets.fire.readings.dee1584.rows)).toBe(true);
    expect(Object.isFrozen(TABLET_VERSION_RULES.gd.variants)).toBe(true);
    expect(Object.keys(TABLET_VERSION_RULES)).toEqual([...TABLET_VERSIONS]);
    for (const version of TABLET_VERSIONS)
      expect(TABLET_VERSION_RULES[version].base).toBe(versionSource(version));
  });

  it("are frozen, and the same object each time", () => {
    const water = view("water", "dee");
    expect(tabletVersion(tablets.water, "dee")).toBe(water);
    expect(Object.isFrozen(water)).toBe(true);
    expect(Object.isFrozen(water.grid[0])).toBe(true);
    expect(Object.isFrozen(water.marks[0])).toBe(true);
    expect(water).toMatchObject({ id: "water", kind: "watchtower" });
  });

  it("are none for an unknown version or no tablet", () => {
    expect(tabletVersion(tablets.water, "nonesuch")).toBeUndefined();
    expect(tabletVersion(tablets.water, "constructor")).toBeUndefined();
    expect(tabletVersion(undefined, "gd")).toBeUndefined();
  });

  it("draw every Watchtower in every version, 13 rows of 12", () => {
    for (const id of WATCHTOWER_IDS)
      for (const version of TABLET_VERSIONS) {
        const tablet = view(id, version);
        expect(tablet.version).toBe(version);
        expect(tablet.grid.map((row) => row.length)).toEqual(
          Array(13).fill(12),
        );
      }
  });

  it("have the Tablet of Union only where the Golden Dawn's sources do", () => {
    for (const version of ["gd", "regardie", "equinox"] as const)
      expect(lines(view("union", version))).toEqual([
        "EXARP",
        "HCOMA",
        "NANTA",
        "BITOM",
      ]);
    expect(tabletVersion(tablets.union, "dee")).toBeUndefined();
    expect(tabletVersion(tablets.union, "raphael")).toBeUndefined();
  });

  it("start from their own source", () => {
    expect(versionSource("gd")).toBe("regardie1940");
    expect(versionSource("regardie")).toBe("regardie1940");
    expect(versionSource("equinox")).toBe("equinox1912");
    expect(versionSource("dee")).toBe("dee1584");
    expect(versionSource("raphael")).toBe("raphael1587");
    for (const id of WATCHTOWER_IDS)
      for (const version of ["regardie", "equinox", "dee", "raphael"] as const)
        expect(lines(view(id, version))).toEqual(
          tabletReading(tablets[id], versionSource(version))?.rows,
        );
  });
});

describe("the Watchtowers' Great Cross", () => {
  // The line of the Holy Spirit, the seventh row, holds three names of God
  // of three, four and five letters (The Equinox, vol. I no. 7, p.235,
  // gives Water's: MPH ARSL GAIOL). Dee's records name each table by them.
  it.each([
    ["air", ["oro", "ibah", "aozpi"]],
    ["water", ["mph", "arsl", "gaiol"]],
    ["earth", ["mor", "dial", "hctga"]],
    ["fire", ["oip", "teaa", "pdoce"]],
  ] as const)(
    "%s reads its names of God on the seventh row in every version",
    (id, names) => {
      for (const version of TABLET_VERSIONS)
        expect(lines(view(id, version))[6].toLowerCase(), version).toBe(
          names.join(""),
        );
    },
  );
});

type Grid = TabletView["grid"];

/** The letters of `at` from row `from` to row `to`, inclusive. */
function column(grid: Grid, at: number, from: number, to: number) {
  let letters = "";
  for (let row = from; row <= to; row++) letters += grid[row][at];
  return letters.toLowerCase();
}

/** The letters of row `at` in these columns. */
const row = (grid: Grid, at: number, columns: readonly number[]) =>
  columns
    .map((index) => grid[at][index])
    .join("")
    .toLowerCase();

describe("the Golden Dawn's version", () => {
  // The six Seniors of each, read from the centre of the Great Cross
  // outwards: along the seventh row to the left and to the right, then up
  // and down the sixth and seventh columns. The names are the Greer
  // edition's (the consecration of the elemental weapons), which settle
  // the squares where the version reads otherwise than Regardie's higher
  // letter (tablets.json5); it spells three of them Saiinor, Aaetpoi and
  // Alhectega, where every source's tablet reads Saiinov, Aaetpio and
  // Alhctga.
  const seniors = (id: EnochianTabletID) => {
    const { grid } = view(id);
    const read = (squares: [number, number][]) =>
      squares
        .map(([row, column]) => grid[row][column])
        .join("")
        .toLowerCase()
        .replaceAll("v", "u");
    const seven = Array.from({ length: 7 }, (_, step) => step);
    return [
      read(seven.map((step) => [6, 6 - step])),
      read(seven.map((step) => [6, 5 + step])),
      read(seven.map((step) => [6 - step, 5])),
      read(seven.map((step) => [6 + step, 5])),
      read(seven.map((step) => [6 - step, 6])),
      read(seven.map((step) => [6 + step, 6])),
    ];
  };

  it.each([
    [
      "water",
      ["lsrahpm", "slgaiol", "saiinou", "soniznt", "laoaxrp", "ligdisa"],
    ],
    [
      "fire",
      ["aaetpio", "aapdoce", "adoeoet", "anodoin", "alnduod", "arinnap"],
    ],
    [
      "earth",
      ["laidrom", "alhctga", "aczinor", "ahmlicu", "lzinopo", "liiansa"],
    ],
    ["air", ["habioro", "ahaozpi", "aaozaif", "autotar", "htmorda", "hipotga"]],
  ] as const)("%s reads its six Seniors", (id, names) => {
    expect(seniors(id)).toEqual(names);
  });

  // The names Liber Chanokh reads off Water: the Calvary Cross of Water of
  // Water and of Air of Water, and Kerubic and servient names (The
  // Equinox, vol. I no. 7, pp.235-236).
  it.each([
    ["nelapr", (grid: Grid) => column(grid, 9, 0, 5)],
    ["omebb", (grid: Grid) => row(grid, 1, [7, 8, 9, 10, 11])],
    ["olgota", (grid: Grid) => column(grid, 2, 0, 5)],
    ["aalco", (grid: Grid) => row(grid, 1, [0, 1, 2, 3, 4])],
    ["tdim", (grid: Grid) => row(grid, 0, [7, 8, 10, 11])],
    ["vssn", (grid: Grid) => row(grid, 4, [7, 8, 10, 11])],
    ["rvoi", (grid: Grid) => row(grid, 5, [7, 8, 10, 11])],
    ["iaaasd", (grid: Grid) => column(grid, 9, 7, 12)],
  ] as const)("Water reads %s", (name, read) => {
    expect(read(view("water").grid)).toBe(name);
  });

  it("keeps both letters of a doubled square", () => {
    // Oblgotca, which the Order draws through Air of Water's third column
    // with both letters of its second and fifth squares.
    const water = view("water");
    const square = (row: number, column: number) =>
      [
        water.grid[row][column],
        ...(markOf(water, row, column)?.alt ?? []),
      ].sort();
    expect(square(1, 2)).toEqual(["b", "l"]);
    expect(square(4, 2)).toEqual(["c", "t"]);
  });

  it("keeps in alt the letters the sources print where it differs", () => {
    const alt = (id: EnochianTabletID, row: number, column: number) =>
      markOf(view(id), row, column)?.alt;
    // Regardie's single letters, read otherwise by the names.
    expect(alt("water", 3, 7)).toEqual(["i"]);
    expect(alt("fire", 4, 5)).toEqual(["a"]);
    expect(alt("earth", 10, 5)).toEqual(["l"]);
    // Regardie's two letters where neither is the version's.
    expect(alt("water", 5, 10)).toEqual(["c", "L"]);
    // His four in one square, the version's N among them.
    expect(alt("water", 4, 11)).toEqual(["y", "l", "h"]);
    // u and v were one letter: the Equinox's U adds nothing to V.
    expect(alt("water", 10, 7)).toBeUndefined();
    expect(alt("water", 0, 5)).toEqual(["v"]);
    for (const id of WATCHTOWER_IDS) {
      const tablet = view(id);
      for (const mark of tablet.marks) {
        const letter = tablet.grid[mark.row][mark.column]?.toLowerCase();
        expect(
          (mark.alt ?? []).map((each) => each.toLowerCase()),
          `${id} ${mark.row},${mark.column}`,
        ).not.toContain(letter);
      }
    }
  });

  it("reverses the letters the Equinox prints in Enochian", () => {
    const reversed = (id: EnochianTabletID) => {
      const tablet = view(id);
      return tablet.marks
        .filter((mark) => mark.reversed)
        .map(({ row, column }) => tablet.grid[row][column]);
    };
    expect(reversed("water")).toEqual(["N", "L"]);
    expect(reversed("fire")).toEqual(["P", "A"]);
    expect(reversed("earth")).toEqual(["R", "A"]);
    expect(reversed("air")).toEqual(["O", "A"]);
  });

  it("reads Earth's eighth row as Regardie's higher letters", () => {
    expect(lines(view("earth"))[7]).toBe("RCanchiisomt");
  });
});

describe("Regardie's and the Equinox's versions", () => {
  it("draw what each prints, Regardie's other letters as alt", () => {
    const regardie = view("water", "regardie");
    expect(regardie.grid[4][11]).toBe("y");
    expect(markOf(regardie, 4, 11)?.alt).toEqual(["l", "N", "h"]);
    expect(regardie.marks.some((mark) => mark.reversed)).toBe(false);
    const equinox = view("water", "equinox");
    expect(equinox.grid[10][7]).toBe("U");
    expect(equinox.marks.every((mark) => !mark.alt)).toBe(true);
    expect(
      equinox.marks
        .filter((mark) => mark.reversed)
        .map(({ row, column }) => [row, column]),
    ).toEqual([
      [4, 11],
      [12, 11],
    ]);
  });
});

describe("Dee's version of 1584", () => {
  it("leaves the two Fire squares every 1584 witness leaves empty", () => {
    const fire = view("fire", "dee");
    expect(fire.grid[0][11]).toBeNull();
    expect(fire.grid[1][10]).toBeNull();
    // Raphael's letters of 1587 stand as their alternatives.
    expect(markOf(fire, 0, 11)).toMatchObject({ alt: ["a"] });
    expect(markOf(fire, 1, 10)).toMatchObject({ alt: ["v"] });
    expect(view("fire", "raphael").grid[0][11]).toBe("a");
    expect(view("fire", "raphael").grid[1][10]).toBe("v");
    // No other version leaves a square empty.
    for (const id of WATCHTOWER_IDS)
      for (const version of TABLET_VERSIONS) {
        const empty = view(id, version)
          .grid.flat()
          .filter((letter) => letter === null).length;
        expect(empty, `${id} ${version}`).toBe(
          id === "fire" && version === "dee" ? 2 : 0,
        );
      }
  });

  it("takes Dee's corrections and keeps the letters first written", () => {
    const corrected = [
      ["air", 2, 6, "r", ["v"]],
      ["water", 4, 2, "t", ["c"]],
      ["water", 4, 11, "N", ["y", "l"]],
      ["water", 12, 3, "n", ["i"]],
    ] as const;
    for (const [id, row, column, letter, dictated] of corrected) {
      expect(view(id, "dee").grid[row][column]).toBe(letter);
      expect(
        readingMark(tabletReading(tablets[id], "dee1584"), row, column)
          ?.dictated,
      ).toEqual(dictated);
      expect(markOf(view(id, "dee"), row, column)?.alt).toEqual(dictated);
    }
    const dictated = WATCHTOWER_IDS.flatMap((id) =>
      (tabletReading(tablets[id], "dee1584")?.marks ?? []).filter(
        (mark) => mark.dictated,
      ),
    );
    expect(dictated).toHaveLength(corrected.length);
  });

  it("reverses the eight smallest letters, which make Paraoan", () => {
    const reversed = WATCHTOWER_IDS.flatMap((id) => {
      const tablet = view(id, "dee");
      return tablet.marks
        .filter((mark) => mark.reversed)
        .map(({ row, column }) => `${id} ${tablet.grid[row][column]}`);
    });
    expect(reversed).toEqual([
      "earth R",
      "earth A",
      "air O",
      "air A",
      "water N",
      "water L",
      "fire P",
      "fire A",
    ]);
  });
});

describe("Raphael's version of 1587", () => {
  it("is Earth's and Air's old letters, in the print's small letters", () => {
    // What the package held for Earth and Air before the versions: the
    // 1587 table's letters, u and v and case aside.
    const old = {
      earth:
        "bOaZaRoPhaRa vNnaxoPSondn aigranoomagg orPmningbeal rsOnizirlemv izinrCziaMhl MOrdialhCtGa OCanchiasomt ArbizmiilPiz OPanaLamSmaP dOloPinianba rxPaocsizixP axtirVastrim",
      air: "rZilafAYtlPa ardZaidPaLam czonsaroYavb ToiTtzoPacoC Sigasomrbznh fmondaTdiari oroibAhaozPi tNabrVixgasd OiiitTPalOai AbamoooaCvca NaocOTtnPrnT ocanmagotroi ShialraPmzox",
    };
    const fold = (text: string) => text.toLowerCase().replaceAll("v", "u");
    for (const id of ["earth", "air"] as const) {
      const raphael = lines(view(id, "raphael"));
      expect(fold(raphael.join(" "))).toBe(fold(old[id]));
      const capitals = raphael.join("").replace(/[^A-Z]/g, "").length;
      expect(capitals, id).toBeLessThan(10);
    }
  });

  it("moves Earth's eighth row one square left", () => {
    const dee = lines(view("earth", "dee"))[7];
    const raphael = lines(view("earth", "raphael"))[7];
    expect(raphael.slice(0, 11).toLowerCase()).toBe(dee.slice(1).toLowerCase());
  });

  it("follows the print's x in two Fire squares, Sloane's p their alternative", () => {
    const fire = view("fire", "raphael");
    for (const [row, column] of [
      [7, 0],
      [11, 3],
    ] as const) {
      expect(fire.grid[row][column]).toBe("x");
      expect(markOf(fire, row, column)).toMatchObject({
        alt: ["p"],
        doubt: "high",
      });
      expect(view("fire", "dee").grid[row][column]?.toLowerCase()).toBe("p");
    }
  });

  it("corrects the print's ten misprints, keeping each", () => {
    const misprints = WATCHTOWER_IDS.flatMap((id) =>
      (tabletReading(tablets[id], "raphael1587")?.marks ?? [])
        .filter((mark) => mark.misprint)
        .map((mark) => {
          const letter = view(id, "raphael").grid[mark.row][mark.column];
          // The corrected letter is the 1584 table's there.
          expect(letter?.toLowerCase()).toBe(
            view(id, "dee").grid[mark.row][mark.column]?.toLowerCase(),
          );
          return mark.misprint;
        }),
    );
    expect(misprints).toHaveLength(10);
  });
});

describe("a reading's letters", () => {
  it("list the first, those beside it and those below", () => {
    const water = tabletReading(tablets.water, "regardie1940");
    expect(readingLetters(water, 4, 11)).toEqual(["y", "l", "N", "h"]);
    expect(readingLetters(water, 6, 6)).toEqual(["l"]);
    expect(
      readingLetters(tabletReading(tablets.fire, "dee1584"), 0, 11),
    ).toEqual([]);
    expect(readingLetters(undefined, 0, 0)).toEqual([]);
    expect(tabletReading(tablets.union, "dee1584")).toBeUndefined();
  });
});

describe("the differences between two versions", () => {
  it("name each square, and how it differs", () => {
    const differences = tabletDifferences(
      view("fire", "dee"),
      view("fire", "raphael"),
    );
    expect(
      differences.filter((each) => each.kind !== "case").slice(0, 3),
    ).toEqual([
      { row: 0, column: 11, kind: "empty", from: null, to: "a" },
      { row: 1, column: 10, kind: "empty", from: null, to: "v" },
      { row: 1, column: 11, kind: "letter", from: "i", to: "a" },
    ]);
    const kinds = new Set(differences.map((each) => each.kind));
    expect(kinds).toEqual(new Set(["empty", "letter", "case", "uv"]));
    expect(tabletDifferences(view("fire"), view("fire"))).toEqual([]);
  });

  it("compare only views of the same tablet", () => {
    expect(() => tabletDifferences(view("fire"), view("water"))).toThrow(
      RangeError,
    );
  });

  it("are the same squares both ways", () => {
    for (const id of WATCHTOWER_IDS) {
      const there = tabletDifferences(view(id, "gd"), view(id, "dee"));
      const back = tabletDifferences(view(id, "dee"), view(id, "gd"));
      expect(back.map(({ row, column, kind }) => [row, column, kind])).toEqual(
        there.map(({ row, column, kind }) => [row, column, kind]),
      );
    }
  });
});
