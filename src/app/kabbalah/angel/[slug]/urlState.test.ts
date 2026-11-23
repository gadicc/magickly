import { describe, expect, it } from "vitest";
import { ANGEL_SIGIL_STYLES } from "@/render/contracts/angelSigil";
import { DEFAULT_STYLE, parseStyleQuery, styleQuery } from "./urlState";

describe("an angel page's URL", () => {
  it("is the band without a style", () => {
    expect(DEFAULT_STYLE).toBe("band");
    expect(parseStyleQuery("")).toBe("band");
    expect(parseStyleQuery("?")).toBe("band");
    expect(parseStyleQuery("?ref=mail")).toBe("band");
    expect(styleQuery("band")).toBe("");
  });

  it("reads each style, among other params", () => {
    expect(parseStyleQuery("?style=bare")).toBe("bare");
    expect(parseStyleQuery("style=rose")).toBe("rose");
    expect(parseStyleQuery("?utm_source=x&style=talisman")).toBe("talisman");
    // The band may be written by hand; the page never writes it.
    expect(parseStyleQuery("?style=band")).toBe("band");
  });

  it("falls back to the band for a value it does not know", () => {
    for (const search of [
      "?style=Talisman",
      "?style=talisman ",
      "?style=",
      "?style=constructor",
      "?style=toString",
      "?style=frame",
    ])
      expect(parseStyleQuery(search), search).toBe("band");
  });

  it("reads back every style it writes, the band left out", () => {
    for (const style of ANGEL_SIGIL_STYLES)
      expect(parseStyleQuery(styleQuery(style))).toBe(style);
    expect(ANGEL_SIGIL_STYLES.map(styleQuery)).toEqual([
      "",
      "?style=bare",
      "?style=rose",
      "?style=talisman",
    ]);
  });
});
