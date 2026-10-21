import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { schemas } from "../schemas.ts";
import tablets, {
  type EnochianTablet,
  type EnochianTabletID,
  WATCHTOWER_IDS,
} from "./Tablets.ts";

const schema = schemas.enochianTablet;

/** A grid of `rows` × `columns` squares, every one `letter`. */
const filled = (rows: number, columns: number, letter = "a") =>
  Array.from({ length: rows }, () => Array<string>(columns).fill(letter));

const issues = (row: unknown) =>
  v.safeParse(schema, row).issues?.map((issue) => issue.message) ?? [];

describe("the tablet schema", () => {
  it("holds every row", () => {
    for (const row of Object.values(tablets))
      expect([row.id, issues(row)]).toEqual([row.id, []]);
  });

  it("gives a Watchtower 13 rows of 12 and the Tablet of Union 4 of 5", () => {
    const shape =
      "a Watchtower's grid is 13 rows of 12 letters, the Tablet of Union's 4 rows of 5";
    const watchtower = { id: "w", kind: "watchtower" };
    const union = { id: "u", kind: "union" };
    expect(issues({ ...watchtower, grid: filled(13, 12) })).toEqual([]);
    expect(issues({ ...union, grid: filled(4, 5) })).toEqual([]);
    expect(issues({ ...watchtower, grid: filled(4, 5) })).toEqual([shape]);
    expect(issues({ ...union, grid: filled(13, 12) })).toEqual([shape]);
    const ragged = filled(13, 12);
    ragged[6] = ragged[6].slice(1);
    expect(issues({ ...watchtower, grid: ragged })).toEqual([shape]);
  });

  it("takes one Latin letter a square, and a kind on every row", () => {
    for (const letter of ["", "ab", "1", "é", " "])
      expect(
        issues({ id: "u", kind: "union", grid: filled(4, 5, letter) }),
      ).not.toEqual([]);
    expect(issues({ id: "u", grid: filled(4, 5) })).not.toEqual([]);
    expect(issues({ id: "u", kind: "spirit", grid: filled(4, 5) })).not.toEqual(
      [],
    );
  });

  it("marks a square of the grid once, with letters or reversed", () => {
    const row = (marks: unknown) => ({
      id: "u",
      kind: "union",
      grid: filled(4, 5),
      marks,
    });
    const message =
      "a mark names a square of the grid once, and gives it letters or reverses it";
    expect(
      issues(
        row([
          { row: 0, column: 0, alt: ["b"] },
          { row: 3, column: 4, reversed: true },
          { row: 1, column: 2, alt: ["b", "c"], reversed: true },
        ]),
      ),
    ).toEqual([]);
    for (const marks of [
      [{ row: 4, column: 0, alt: ["b"] }],
      [{ row: 0, column: 5, alt: ["b"] }],
      [{ row: 0, column: 0 }],
      [{ row: 0, column: 0, alt: [] }],
      [{ row: 0, column: 0, reversed: false }],
      [
        { row: 0, column: 0, alt: ["b"] },
        { row: 0, column: 0, reversed: true },
      ],
    ])
      expect(issues(row(marks))).toEqual([message]);
    for (const marks of [
      [{ row: -1, column: 0, alt: ["b"] }],
      [{ row: 0.5, column: 0, alt: ["b"] }],
      [{ row: 0, column: 0, alt: ["bc"] }],
      [{ row: 0, column: 0, alt: ["b"], colour: "red" }],
    ])
      expect(issues(row(marks))).not.toEqual([]);
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

type Grid = EnochianTablet["grid"];

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

describe("the Watchtowers' Great Cross", () => {
  // The line of the Holy Spirit, the seventh row, holds three names of God
  // of three, four and five letters (The Equinox, vol. I no. 7, p.235,
  // gives Water's: MPH ARSL GAIOL).
  it.each([
    ["air", ["oro", "ibah", "aozpi"]],
    ["water", ["mph", "arsl", "gaiol"]],
    ["earth", ["mor", "dial", "hctga"]],
    ["fire", ["oip", "teaa", "pdoce"]],
  ] as const)("%s reads its names of God on the seventh row", (id, names) => {
    expect(tablets[id].grid[6].join("").toLowerCase()).toBe(names.join(""));
  });
});

describe("the Golden Dawn's Water and Fire", () => {
  // The six Seniors of each, read from the centre of the Great Cross
  // outwards: along the seventh row to the left and to the right, then up
  // and down the sixth and seventh columns. The names are the Greer
  // edition's (the consecration of the elemental weapons), which settle
  // four of the squares where the data reads otherwise than Regardie's
  // higher letter (tablets.json5); it spells two of them Saiinor and
  // Aaetpoi, where every source's tablet reads Saiinov and Aaetpio.
  const seniors = (id: EnochianTabletID) => {
    const { grid } = tablets[id];
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
    expect(read(tablets.water.grid)).toBe(name);
  });

  it("keeps both letters of a doubled square", () => {
    // Oblgotca, which the Order draws through Air of Water's third column
    // with both letters of its second and fifth squares.
    const water: EnochianTablet = tablets.water;
    const square = (row: number, column: number) =>
      [
        water.grid[row][column],
        ...(water.marks?.find(
          (mark) => mark.row === row && mark.column === column,
        )?.alt ?? []),
      ].sort();
    expect(square(1, 2)).toEqual(["b", "l"]);
    expect(square(4, 2)).toEqual(["c", "t"]);
  });

  it("keeps in alt the letters the sources print where the grid differs", () => {
    const alt = (id: EnochianTabletID, row: number, column: number) => {
      const tablet: EnochianTablet = tablets[id];
      return tablet.marks?.find(
        (mark) => mark.row === row && mark.column === column,
      )?.alt;
    };
    // Regardie's single letters, read otherwise by the names.
    expect(alt("water", 3, 7)).toEqual(["i"]);
    expect(alt("fire", 4, 5)).toEqual(["a"]);
    // Regardie's two letters where neither is the grid's.
    expect(alt("water", 5, 10)).toEqual(["c", "L"]);
    for (const id of ["water", "fire"] as const) {
      const tablet: EnochianTablet = tablets[id];
      for (const mark of tablet.marks ?? []) {
        const letter = tablet.grid[mark.row][mark.column].toLowerCase();
        expect(
          (mark.alt ?? []).map((each) => each.toLowerCase()),
          `${id} ${mark.row},${mark.column}`,
        ).not.toContain(letter);
      }
    }
  });

  it("marks the letters printed reversed", () => {
    const reversed = (id: EnochianTabletID) => {
      const tablet: EnochianTablet = tablets[id];
      return (tablet.marks ?? [])
        .filter((mark) => mark.reversed)
        .map(({ row, column }) => tablet.grid[row][column]);
    };
    expect(reversed("water")).toEqual(["N", "L"]);
    expect(reversed("fire")).toEqual(["P", "A"]);
  });
});

describe("the Tablet of Union", () => {
  it("reads EXARP, HCOMA, NANTA and BITOM, Air, Water, Earth and Fire", () => {
    expect(tablets.union.kind).toBe("union");
    expect(tablets.union.grid.map((row) => row.join(""))).toEqual([
      "EXARP",
      "HCOMA",
      "NANTA",
      "BITOM",
    ]);
  });
});
