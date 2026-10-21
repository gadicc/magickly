import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { schemas } from "../schemas.ts";
import tablets, { type EnochianTabletID, WATCHTOWER_IDS } from "./Tablets.ts";

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

describe("the Watchtowers' Great Cross", () => {
  // The line of the Holy Spirit, the seventh row, holds three names of God
  // of three, four and five letters.
  it.each([
    ["air", ["oro", "ibah", "aozpi"]],
    ["earth", ["mor", "dial", "hctga"]],
  ] as const)("%s reads its names of God on the seventh row", (id, names) => {
    expect(tablets[id].grid[6].join("").toLowerCase()).toBe(names.join(""));
  });
});
