import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pageProse } from "../../scripts/search/prose";
import ToolLayout, { ToolControls, ToolDrawing, ToolPanel } from "./ToolLayout";

describe("a drawing tool's layout", () => {
  it("keeps the controls, the drawing and the panel in that order", () => {
    // A phone and a screen reader take them so; the grid moves the
    // drawing beside the others from 1,200 px.
    const html = renderToString(
      <ToolLayout>
        <ToolControls>
          <i>controls</i>
        </ToolControls>
        <ToolDrawing>
          <svg />
        </ToolDrawing>
        <ToolPanel>
          <b>panel</b>
        </ToolPanel>
      </ToolLayout>,
    );
    const at = ["<i>controls</i>", "<svg>", "<b>panel</b>"].map((part) =>
      html.indexOf(part),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("keeps a page's text where site search reads it", () => {
    // scripts/search/prose.ts reads JSX children and skips props: text
    // passed to a part as a prop would drop out of the index.
    const root = resolve(".");
    expect(pageProse(root, "/gd/symbols/fylfot-cross")).toContain(
      "NB: This is NOT the Nazi symbol",
    );
    expect(pageProse(root, "/gd/sigils")).toContain("Invalid characters:");
  });
});
