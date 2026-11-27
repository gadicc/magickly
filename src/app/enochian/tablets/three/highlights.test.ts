import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import { describe, expect, it, vi } from "vitest";
import { chosenBy, squareTints, TINTS } from "./highlights";
import { MARKS_SHEET } from "./marksSheet.generated";
import { tabletModel } from "./model";

const fire = tabletVersion(enochianTablets.fire, "gd");
if (!fire) throw new Error("no Fire tablet");
const model = tabletModel(fire, MARKS_SHEET);

/** The tint `squareTints` gives a square. */
const tintAt = (tints: Float32Array, row: number, column: number) => {
  const index = model.squares[row * model.columns + column];
  return [...tints.subarray(index * 4, index * 4 + 4)];
};
const as32 = (tint: readonly number[]) => [...new Float32Array(tint)];

describe("the 3D view's highlights (plan 101, stage 4)", () => {
  it("tints nothing without highlights", () => {
    expect(squareTints(model, undefined).every((value) => value === 0)).toBe(
      true,
    );
    expect(squareTints(model, { squares: [] }).length).toBe(
      model.pyramids.length * 4,
    );
  });

  it("tints each kind, the selected square first", () => {
    const tints = squareTints(model, {
      squares: [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 0, column: 2 },
      ],
      selected: { row: 0, column: 0 },
      preview: {
        squares: [
          { row: 0, column: 1 },
          { row: 5, column: 5 },
        ],
      },
      name: {
        squares: [
          { row: 0, column: 2 },
          { row: 7, column: 7 },
        ],
      },
    });
    expect(tintAt(tints, 0, 0)).toEqual(as32(TINTS.selected));
    expect(tintAt(tints, 0, 1)).toEqual(as32(TINTS.preview));
    expect(tintAt(tints, 5, 5)).toEqual(as32(TINTS.preview));
    expect(tintAt(tints, 0, 2)).toEqual(as32(TINTS.squares));
    expect(tintAt(tints, 7, 7)).toEqual(as32(TINTS.name));
    // A chosen name veils every other square, as the flat drawing does.
    expect(tintAt(tints, 12, 11)).toEqual(as32(TINTS.dimmed));
  });

  it("veils nothing without a chosen name", () => {
    const tints = squareTints(model, {
      squares: [{ row: 3, column: 4 }],
      preview: { squares: [{ row: 1, column: 1 }] },
    });
    expect(tintAt(tints, 3, 4)).toEqual(as32(TINTS.squares));
    expect(tintAt(tints, 12, 11)).toEqual(as32(TINTS.none));
  });

  it("dims to white, and tints with the flat drawing's violets", () => {
    expect(TINTS.dimmed).toEqual([1, 1, 1, 0.72]);
    expect(TINTS.selected[3]).toBeGreaterThan(TINTS.squares[3]);
    expect(TINTS.none[3]).toBe(0);
  });

  it("chooses a clicked square only as the flat drawing does", () => {
    const onSelect = vi.fn();
    const outlined = { row: 2, column: 3 };
    const other = { row: 9, column: 9 };
    // The Differences tab: only the outlined squares.
    expect(chosenBy({ squares: [outlined], onSelect }, outlined)).toEqual(
      outlined,
    );
    expect(chosenBy({ squares: [outlined], onSelect }, other)).toBeUndefined();
    // Names and Squares: any square.
    expect(chosenBy({ squares: [], anySquare: true, onSelect }, other)).toEqual(
      other,
    );
    // Nothing to call.
    expect(chosenBy({ squares: [outlined] }, outlined)).toBeUndefined();
    expect(chosenBy(undefined, outlined)).toBeUndefined();
    // Only the row and column, whatever the pick carried.
    expect(
      chosenBy({ squares: [], anySquare: true, onSelect }, {
        ...other,
        index: 5,
      } as typeof other),
    ).toEqual(other);
  });
});
