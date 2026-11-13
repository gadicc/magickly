import { describe, expect, it } from "vitest";
import { componentImage } from "./images";

describe("componentImage", () => {
  it("maps the Tree's props to its image's query", () => {
    expect(componentImage("TreeOfLife", {})).toBe("/api/render/tree-of-life");
    expect(
      componentImage("TreeOfLife", {
        colorScale: "king",
        active: "tiferet",
        width: "100%",
      }),
    ).toBe("/api/render/tree-of-life?colorScale=king&active=tiferet");
  });

  it("maps the sigil's text, and its rose", () => {
    expect(
      componentImage("RoseSigil", { sigilText: "אדני", showRose: false }),
    ).toBe(
      `/api/render/rose-sigil?text=${encodeURIComponent("אדני")}&rose=false`,
    );
  });

  it("has none for what the image cannot draw", () => {
    expect(
      componentImage("RoseSigil", { sigilText: "אדני", debug: true }),
    ).toBe(null);
    expect(componentImage("RoseSigil", { sigilText: "abc" })).toBe(null);
    expect(componentImage("Tablet", { id: "union" })).toBe(null);
    expect(componentImage("Tablet", { id: "water", alt: true })).toBe(null);
    expect(componentImage("TreeOfLife", { labels: ["a"] })).toBe(null);
    expect(componentImage("TreeOfLife", { active: "nowhere" })).toBe(null);
    expect(componentImage("Kamea", { planet: "saturn" })).toBe(null);
  });

  it("draws a tablet in its version, and the two fixed figures", () => {
    expect(componentImage("Tablet", { id: "fire", version: "dee" })).toBe(
      "/api/render/enochian-tablet?id=fire&version=dee",
    );
    expect(componentImage("SevenBranchedCandleStick", {})).toBe(
      "/api/render/seven-branched-candlestick",
    );
    expect(componentImage("TableOfShewbread", {})).toBe(
      "/api/render/table-of-shewbread",
    );
  });
});
