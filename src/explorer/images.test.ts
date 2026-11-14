import { describe, expect, it } from "vitest";
import { componentImage } from "./images";

describe("componentImage", () => {
  it("maps the Tree's props to its image's query", () => {
    // The component's defaults, the Tree page's, which the image's query
    // states, since its own are the Tree's first ones.
    expect(componentImage("TreeOfLife", {})).toBe(
      "/api/render/tree-of-life?field=name.roman&bottomText=name.en&fontSize=10",
    );
    expect(
      componentImage("TreeOfLife", {
        field: "index",
        bottomText: "",
        colorScale: "king",
        activeSephirah: "tiferet",
        width: "100%",
      }),
    ).toBe("/api/render/tree-of-life?colorScale=king&active=tiferet");
    expect(componentImage("TreeOfLife", { field: "name.he" })).toBe(
      "/api/render/tree-of-life?field=name.he&bottomText=name.en",
    );
  });

  it("maps the sigil's text, and its rose", () => {
    expect(componentImage("RoseSigil", { text: "אדני", showRose: false })).toBe(
      `/api/render/rose-sigil?text=${encodeURIComponent("אדני")}&rose=false`,
    );
    expect(
      componentImage("RoseSigil", { text: "כתר", version: "regardie1939" }),
    ).toBe(
      `/api/render/rose-sigil?text=${encodeURIComponent("כתר")}&version=regardie1939`,
    );
    expect(componentImage("RoseSigil", { text: "כתר", version: "gd" })).toBe(
      `/api/render/rose-sigil?text=${encodeURIComponent("כתר")}`,
    );
  });

  it("has none for what the image cannot draw", () => {
    expect(componentImage("RoseSigil", { text: "abc" })).toBe(null);
    expect(componentImage("Tablet", { tablet: "union" })).toBe(null);
    expect(
      componentImage("Tablet", { tablet: "water", showSecondLetters: true }),
    ).toBe(null);
    expect(componentImage("TreeOfLife", { labels: ["a"] })).toBe(null);
    expect(componentImage("TreeOfLife", { activeSephirah: "nowhere" })).toBe(
      null,
    );
    expect(componentImage("TreeOfLife", { activeSephirah: null })).toBe(null);
    expect(componentImage("Kamea", { planet: "saturn" })).toBe(null);
  });

  it("draws a tablet in its version, and the two fixed figures", () => {
    expect(componentImage("Tablet", { tablet: "fire", version: "dee" })).toBe(
      "/api/render/enochian-tablet?id=fire&version=dee",
    );
    expect(componentImage("SevenBranchedCandlestick", {})).toBe(
      "/api/render/seven-branched-candlestick",
    );
    expect(componentImage("TableOfShewbread", {})).toBe(
      "/api/render/table-of-shewbread",
    );
  });
});
