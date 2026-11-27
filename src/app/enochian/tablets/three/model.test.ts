import enochianTablets, {
  type TabletView,
  tabletVersion,
} from "magick-data/enochian/tablets";
import { describe, expect, it } from "vitest";
import { MARKS_SHEET } from "./marksSheet.generated";
import { markKey, srgbToLinear, TOP_PAINT, tabletModel } from "./model";

const view = (tablet: keyof typeof enochianTablets, version: string) =>
  tabletVersion(
    enochianTablets[tablet],
    version as TabletView["version"],
  ) as TabletView;

describe("srgbToLinear", () => {
  it("decodes sRGB by its transfer function", () => {
    expect(srgbToLinear("#000000")).toEqual([0, 0, 0]);
    expect(srgbToLinear("#FFFFFF")).toEqual([1, 1, 1]);
    // The linear segment below 0.04045, and the curve above it.
    const [low, mid, high] = srgbToLinear("#0a80ff");
    expect(low).toBeCloseTo(10 / 255 / 12.92, 12);
    expect(mid).toBeCloseTo(0.2158605, 6);
    expect(high).toBe(1);
  });

  it("refuses anything but #rrggbb", () => {
    expect(() => srgbToLinear("#fff")).toThrow(/Not an sRGB colour/);
    expect(() => srgbToLinear("white")).toThrow(/Not an sRGB colour/);
  });
});

describe("markKey", () => {
  it("names each kind of mark apart", () => {
    expect(markKey({ kind: "element", element: "fire" })).toBe("element:fire");
    expect(markKey({ kind: "figure", rows: [1, 2, 2, 1] })).toBe("figure:1221");
    expect(markKey({ kind: "text", text: "4" })).toBe("text:4");
    expect(markKey({ kind: "text", text: "א", hebrew: true })).toBe("hebrew:א");
  });
});

describe("tabletModel", () => {
  it("lays out a tablet's squares and points each at its pyramid", () => {
    const model = tabletModel(view("union", "gd"), MARKS_SHEET);
    expect([model.rows, model.columns]).toEqual([4, 5]);
    model.pyramids.forEach(({ row, column }, index) => {
      expect(model.squares[row * model.columns + column]).toBe(index);
    });
    expect(TOP_PAINT.colour).toEqual([1, 1, 1]);
  });

  it("mirrors the version's reversed letters unless told not to", () => {
    const gd = view("earth", "gd");
    const reversed = gd.marks
      .filter((mark) => mark.reversed)
      .map(({ row, column }) => `${row},${column}`);
    expect(reversed.length).toBeGreaterThan(0);
    const mirrored = (model: ReturnType<typeof tabletModel>) =>
      model.pyramids
        .filter((p) => p.mirrored)
        .map(({ row, column }) => `${row},${column}`);
    expect(mirrored(tabletModel(gd, MARKS_SHEET))).toEqual(reversed);
    expect(
      mirrored(tabletModel(gd, MARKS_SHEET, { mirrorReversed: false })),
    ).toEqual([]);
  });

  it("draws nothing for a version without pyramids", () => {
    const model = tabletModel(view("earth", "dee"), MARKS_SHEET);
    expect(model.pyramids).toEqual([]);
    expect(model.squares.every((index) => index === -1)).toBe(true);
  });

  it("gives a square with no letter no letter's cell", () => {
    const gd = view("earth", "gd");
    const holed: TabletView = {
      ...gd,
      grid: gd.grid.map((row, at) =>
        at === 0 ? [null, ...row.slice(1)] : row,
      ),
    };
    const [first] = tabletModel(holed, MARKS_SHEET).pyramids;
    expect(first).toMatchObject({ letter: null, letterCell: -1 });
  });

  it("fails on a sheet that lacks a mark", () => {
    expect(() =>
      tabletModel(view("union", "gd"), { ...MARKS_SHEET, marks: {} }),
    ).toThrow(/run pnpm tablet3d:sheet/);
  });
});
