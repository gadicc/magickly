import { TABLET_VERSIONS } from "magick-data/enochian/tablets";
import { describe, expect, it } from "vitest";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";
import { DEFAULT_CHOICE, parseTabletQuery, tabletQuery } from "./urlState";

describe("the tablets page's URL", () => {
  it("is Earth in the Golden Dawn's version without choices", () => {
    expect(DEFAULT_CHOICE).toEqual({ tablet: "earth", version: "gd" });
    expect(parseTabletQuery("")).toEqual(DEFAULT_CHOICE);
    expect(parseTabletQuery("?")).toEqual(DEFAULT_CHOICE);
    expect(tabletQuery(DEFAULT_CHOICE)).toBe("");
  });

  it("reads each choice, with or without the other", () => {
    expect(parseTabletQuery("?tablet=air&version=dee")).toEqual({
      tablet: "air",
      version: "dee",
    });
    expect(parseTabletQuery("tablet=fire")).toEqual({
      tablet: "fire",
      version: "gd",
    });
    // The Tablet of Union, in a version that has it or not: the page
    // says when it has none.
    expect(parseTabletQuery("?tablet=union&version=dee")).toEqual({
      tablet: "union",
      version: "dee",
    });
    expect(parseTabletQuery("?version=raphael&utm_source=x")).toEqual({
      tablet: "earth",
      version: "raphael",
    });
  });

  it("ignores values it does not know", () => {
    for (const search of [
      "?tablet=Union",
      "?tablet=Air",
      "?tablet=constructor",
      "?tablet=",
      "?version=GD",
      "?version=toString",
      "?version=",
    ])
      expect(parseTabletQuery(search), search).toEqual(DEFAULT_CHOICE);
    expect(parseTabletQuery("?tablet=water&version=nope")).toEqual({
      tablet: "water",
      version: "gd",
    });
  });

  it("leaves the defaults out", () => {
    expect(tabletQuery({ tablet: "air", version: "gd" })).toBe("?tablet=air");
    expect(tabletQuery({ tablet: "earth", version: "dee" })).toBe(
      "?version=dee",
    );
    expect(tabletQuery({ tablet: "fire", version: "equinox" })).toBe(
      "?tablet=fire&version=equinox",
    );
  });

  it("reads back every choice it writes", () => {
    for (const tablet of TABLET_IDS)
      for (const version of TABLET_VERSIONS) {
        const choice = { tablet, version };
        expect(parseTabletQuery(tabletQuery(choice))).toEqual(choice);
      }
  });
});

describe("the tablets page's tab and square in its URL", () => {
  it("reads the tab, leaving out Names and what it does not know", () => {
    expect(parseTabletQuery("?tab=squares")).toEqual({
      ...DEFAULT_CHOICE,
      tab: "squares",
    });
    expect(parseTabletQuery("?tab=differences").tab).toBe("differences");
    for (const search of ["?tab=names", "?tab=Squares", "?tab=", "?tab=x"])
      expect(parseTabletQuery(search), search).toEqual(DEFAULT_CHOICE);
  });

  it("reads a square from 1, on the tablet's grid only", () => {
    expect(parseTabletQuery("?tab=squares&square=7,6").square).toEqual({
      row: 6,
      column: 5,
    });
    expect(parseTabletQuery("?tab=squares&square=13,12").square).toEqual({
      row: 12,
      column: 11,
    });
    for (const search of [
      "?tab=squares&square=0,1",
      "?tab=squares&square=14,1",
      "?tab=squares&square=1,13",
      "?tab=squares&square=7",
      "?tab=squares&square=7,6,1",
      "?tab=squares&square=a,b",
      "?tab=squares&square=-1,2",
      "?tab=squares&square=7%2C6x",
    ])
      expect(parseTabletQuery(search).square, search).toBeUndefined();
    // The Tablet of Union is 4 rows of 5.
    expect(
      parseTabletQuery("?tablet=union&tab=squares&square=4,5").square,
    ).toEqual({
      row: 3,
      column: 4,
    });
    expect(
      parseTabletQuery("?tablet=union&tab=squares&square=5,1").square,
    ).toBeUndefined();
    expect(
      parseTabletQuery("?tablet=union&tab=squares&square=1,6").square,
    ).toBeUndefined();
  });

  it("drops the square in Dee's and Raphael's versions, which have no pyramids", () => {
    expect(
      parseTabletQuery("?version=dee&tab=squares&square=7,6").square,
    ).toBeUndefined();
    expect(
      parseTabletQuery("?version=raphael&tab=squares&square=7,6").square,
    ).toBeUndefined();
    expect(
      parseTabletQuery("?version=equinox&tab=squares&square=7,6").square,
    ).toEqual({
      row: 6,
      column: 5,
    });
    expect(
      tabletQuery({
        tablet: "earth",
        version: "dee",
        tab: "squares",
        square: { row: 6, column: 5 },
      }),
    ).toBe("?version=dee&tab=squares");
  });

  it("holds a square only with the Squares tab open", () => {
    expect(parseTabletQuery("?square=7,6").square).toBeUndefined();
    expect(
      parseTabletQuery("?tab=differences&square=7,6").square,
    ).toBeUndefined();
    expect(
      tabletQuery({
        ...DEFAULT_CHOICE,
        tab: "names",
        square: { row: 6, column: 5 },
      }),
    ).toBe("");
    expect(
      tabletQuery({ ...DEFAULT_CHOICE, square: { row: 6, column: 5 } }),
    ).toBe("");
  });

  it("writes no square off the tablet's grid", () => {
    expect(
      tabletQuery({
        tablet: "union",
        version: "gd",
        tab: "squares",
        square: { row: 12, column: 11 },
      }),
    ).toBe("?tablet=union&tab=squares");
  });

  it("writes the tab and the square, the comma as it is", () => {
    expect(
      tabletQuery({
        tablet: "air",
        version: "gd",
        tab: "squares",
        square: { row: 2, column: 0 },
      }),
    ).toBe("?tablet=air&tab=squares&square=3,1");
    expect(tabletQuery({ ...DEFAULT_CHOICE, tab: "names" })).toBe("");
  });

  it("reads back every square it writes", () => {
    for (const tablet of TABLET_IDS)
      for (const version of TABLET_VERSIONS) {
        const rows = tablet === "union" ? 4 : 13;
        const columns = tablet === "union" ? 5 : 12;
        for (let row = 0; row < rows; row++)
          for (let column = 0; column < columns; column++) {
            const choice = {
              tablet,
              version,
              tab: "squares" as const,
              square: { row, column },
            };
            const read = parseTabletQuery(tabletQuery(choice));
            expect(read.square).toEqual(
              version === "dee" || version === "raphael"
                ? undefined
                : { row, column },
            );
            expect(read.tab).toBe("squares");
          }
      }
  });
});
