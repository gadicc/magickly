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

describe("the tablets page's pyramids in its URL (plan 095, decision 4)", () => {
  it("reads pyramids=1 in the Golden Dawn's versions only", () => {
    expect(parseTabletQuery("?pyramids=1")).toEqual({
      ...DEFAULT_CHOICE,
      pyramids: true,
    });
    expect(
      parseTabletQuery("?tablet=union&version=equinox&pyramids=1"),
    ).toEqual({ tablet: "union", version: "equinox", pyramids: true });
    for (const value of ["0", "true", "", "yes"])
      expect(parseTabletQuery(`?pyramids=${value}`)).toEqual(DEFAULT_CHOICE);
    for (const version of ["dee", "raphael"])
      expect(parseTabletQuery(`?version=${version}&pyramids=1`)).toEqual({
        tablet: "earth",
        version,
      });
  });

  it("writes it with the other choices, and drops it under Dee's and Raphael's", () => {
    expect(tabletQuery({ ...DEFAULT_CHOICE, pyramids: true })).toBe(
      "?pyramids=1",
    );
    expect(
      tabletQuery({
        tablet: "fire",
        version: "regardie",
        tab: "squares",
        square: { row: 6, column: 5 },
        pyramids: true,
      }),
    ).toBe("?tablet=fire&version=regardie&tab=squares&square=7,6&pyramids=1");
    expect(tabletQuery({ ...DEFAULT_CHOICE, pyramids: false })).toBe("");
    expect(tabletQuery({ tablet: "air", version: "dee", pyramids: true })).toBe(
      "?tablet=air&version=dee",
    );
  });

  it("reads back what it writes, in every version", () => {
    for (const tablet of TABLET_IDS)
      for (const version of TABLET_VERSIONS)
        expect(
          parseTabletQuery(tabletQuery({ tablet, version, pyramids: true }))
            .pyramids,
        ).toBe(version === "dee" || version === "raphael" ? undefined : true);
  });
});

describe("the pyramids' symbols in the tablets page's URL (plan 095, Symbols on the sides)", () => {
  it("reads symbols=1 with pyramids, and upright=1 with symbols", () => {
    expect(parseTabletQuery("?pyramids=1&symbols=1")).toEqual({
      ...DEFAULT_CHOICE,
      pyramids: true,
      symbols: true,
    });
    expect(parseTabletQuery("?pyramids=1&symbols=1&upright=1")).toEqual({
      ...DEFAULT_CHOICE,
      pyramids: true,
      symbols: true,
      upright: true,
    });
    // Each only with the switch it hangs on.
    expect(parseTabletQuery("?symbols=1&upright=1")).toEqual(DEFAULT_CHOICE);
    expect(parseTabletQuery("?pyramids=1&upright=1")).toEqual({
      ...DEFAULT_CHOICE,
      pyramids: true,
    });
    expect(
      parseTabletQuery("?version=dee&pyramids=1&symbols=1&upright=1"),
    ).toEqual({ ...DEFAULT_CHOICE, version: "dee" });
    for (const value of ["0", "true", ""])
      expect(parseTabletQuery(`?pyramids=1&symbols=${value}`)).toEqual({
        ...DEFAULT_CHOICE,
        pyramids: true,
      });
  });

  it("writes each only while its switch shows", () => {
    expect(
      tabletQuery({ ...DEFAULT_CHOICE, pyramids: true, symbols: true }),
    ).toBe("?pyramids=1&symbols=1");
    expect(
      tabletQuery({
        ...DEFAULT_CHOICE,
        pyramids: true,
        symbols: true,
        upright: true,
      }),
    ).toBe("?pyramids=1&symbols=1&upright=1");
    expect(
      tabletQuery({ ...DEFAULT_CHOICE, symbols: true, upright: true }),
    ).toBe("");
    expect(
      tabletQuery({
        ...DEFAULT_CHOICE,
        pyramids: true,
        symbols: false,
        upright: true,
      }),
    ).toBe("?pyramids=1");
    expect(
      tabletQuery({
        tablet: "air",
        version: "raphael",
        pyramids: true,
        symbols: true,
        upright: true,
      }),
    ).toBe("?tablet=air&version=raphael");
  });
});

describe("the 3D view in the tablets page's URL (plan 101)", () => {
  it("reads 3d=1 with pyramids only", () => {
    expect(parseTabletQuery("?pyramids=1&3d=1")).toEqual({
      ...DEFAULT_CHOICE,
      pyramids: true,
      threeD: true,
    });
    expect(parseTabletQuery("?3d=1")).toEqual(DEFAULT_CHOICE);
    expect(parseTabletQuery("?version=raphael&pyramids=1&3d=1")).toEqual({
      ...DEFAULT_CHOICE,
      version: "raphael",
    });
    for (const value of ["0", "true", ""])
      expect(parseTabletQuery(`?pyramids=1&3d=${value}`)).toEqual({
        ...DEFAULT_CHOICE,
        pyramids: true,
      });
  });

  it("writes it while its switch shows, after the pyramids", () => {
    expect(
      tabletQuery({
        ...DEFAULT_CHOICE,
        pyramids: true,
        threeD: true,
        symbols: true,
      }),
    ).toBe("?pyramids=1&3d=1&symbols=1");
    expect(tabletQuery({ ...DEFAULT_CHOICE, threeD: true })).toBe("");
    expect(
      tabletQuery({
        ...DEFAULT_CHOICE,
        version: "dee",
        pyramids: true,
        threeD: true,
      }),
    ).toBe("?version=dee");
    const choice = { ...DEFAULT_CHOICE, pyramids: true, threeD: true };
    expect(parseTabletQuery(tabletQuery(choice))).toEqual(choice);
  });
});
