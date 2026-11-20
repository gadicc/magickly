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
