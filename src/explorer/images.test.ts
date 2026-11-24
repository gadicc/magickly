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
    // No Tablet of Union in Dee's or Raphael's versions.
    expect(componentImage("Tablet", { tablet: "union", version: "dee" })).toBe(
      null,
    );
    expect(
      componentImage("Tablet", { tablet: "water", showSecondLetters: true }),
    ).toBe(null);
    expect(componentImage("TreeOfLife", { labels: ["a"] })).toBe(null);
    expect(componentImage("TreeOfLife", { activeSephirah: "nowhere" })).toBe(
      null,
    );
    expect(componentImage("TreeOfLife", { activeSephirah: null })).toBe(null);
    // A square in the caller's own colours or font.
    expect(componentImage("Kamea", { planet: "luna", paper: "#1d2b53" })).toBe(
      null,
    );
    expect(
      componentImage("KameaSigil", {
        planet: "saturn",
        text: "אגיאל",
        ink: "blue",
      }),
    ).toBe(null);
    // No text, or one the contract refuses.
    expect(componentImage("KameaSigil", { planet: "saturn" })).toBe(null);
    expect(
      componentImage("KameaSigil", { planet: "saturn", text: "Agiel" }),
    ).toBe(null);
    expect(componentImage("PlanetarySeal", { planet: "saturn" })).toBe(null);
    expect(
      componentImage("Kamea", { planet: "saturn", children: "drawn over" }),
    ).toBe(null);
  });

  it("maps a kamea's planet, and its sigil's text and finals", () => {
    expect(componentImage("Kamea", { planet: "saturn" })).toBe(
      "/api/render/kamea?planet=saturn",
    );
    expect(
      componentImage("KameaSigil", { planet: "venus", text: "בני שרפים" }),
    ).toBe(
      `/api/render/kamea-sigil?${new URLSearchParams({ planet: "venus", text: "בני שרפים" })}`,
    );
    expect(
      componentImage("KameaSigil", {
        planet: "luna",
        text: "אלים",
        finals: true,
        size: 400,
      }),
    ).toBe(
      `/api/render/kamea-sigil?${new URLSearchParams({ planet: "luna", text: "אלים", finals: "true" })}`,
    );
  });

  it("draws a tablet in its version, and the two fixed figures", () => {
    expect(componentImage("Tablet", { tablet: "fire", version: "dee" })).toBe(
      "/api/render/enochian-tablet?id=fire&version=dee",
    );
    expect(componentImage("Tablet", { tablet: "union" })).toBe(
      "/api/render/enochian-tablet?id=union",
    );
    expect(componentImage("SevenBranchedCandlestick", {})).toBe(
      "/api/render/seven-branched-candlestick",
    );
    expect(
      componentImage("SevenBranchedCandlestick", { version: "modern" }),
    ).toBe("/api/render/seven-branched-candlestick?version=modern");
    expect(componentImage("TableOfShewbread", {})).toBe(
      "/api/render/table-of-shewbread",
    );
  });

  it("draws a tablet as pyramids with their own image, at the top's default", () => {
    expect(componentImage("Tablet", { tablet: "fire", pyramids: true })).toBe(
      "/api/render/enochian-tablet-pyramids?id=fire",
    );
    expect(
      componentImage("Tablet", {
        tablet: "union",
        version: "equinox",
        pyramids: true,
      }),
    ).toBe("/api/render/enochian-tablet-pyramids?id=union&version=equinox");
    // With their symbols, facing out or upright.
    expect(
      componentImage("Tablet", {
        tablet: "water",
        pyramids: true,
        pyramidSymbols: "outward",
      }),
    ).toBe("/api/render/enochian-tablet-pyramids?id=water&symbols=outward");
    expect(
      componentImage("Tablet", {
        tablet: "air",
        version: "regardie",
        pyramids: true,
        pyramidSymbols: "upright",
      }),
    ).toBe(
      "/api/render/enochian-tablet-pyramids?id=air&version=regardie&symbols=upright",
    );
    // A value the component draws nothing for, which the image refuses.
    expect(
      componentImage("Tablet", {
        tablet: "air",
        pyramids: true,
        pyramidSymbols: "inward",
      }),
    ).toBe(null);
    // The flat tablet's, with the switch off.
    expect(componentImage("Tablet", { tablet: "fire", pyramids: false })).toBe(
      "/api/render/enochian-tablet?id=fire",
    );
    // A top of the caller's own, which the image does not draw, even the
    // default given by hand; and Dee's version, which has no pyramids.
    for (const pyramidTop of [0.25, 0.5])
      expect(
        componentImage("Tablet", {
          tablet: "union",
          pyramids: true,
          pyramidTop,
        }),
      ).toBe(null);
    expect(
      componentImage("Tablet", {
        tablet: "fire",
        version: "dee",
        pyramids: true,
      }),
    ).toBe(null);
    expect(
      componentImage("Tablet", {
        tablet: "earth",
        pyramids: true,
        highlights: { squares: [] },
      }),
    ).toBe(null);
  });
});
