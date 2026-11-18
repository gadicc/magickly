import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import { roseSigilLayout } from "./roseSigilLayout.ts";

const anchorPaths = (svg: string) =>
  [...svg.matchAll(/<path stroke="#aa0" fill="none" d="([^"]*)"/g)].map(
    (m) => m[1],
  );

describe("RoseSigilImage", () => {
  it("draws each word on its own rose, the second shifted into its region", () => {
    const svg = renderToStaticMarkup(
      <RoseSigilImage text="יהוה אלהים" showRose />,
    );
    // The first word sits on the rose's own coordinates; the second is
    // translated, with its own rose behind it.
    expect(svg.match(/<g transform="translate\(/g)).toHaveLength(1);
    expect(svg).toContain('viewBox="-150 -50 200 100"');
  });

  it("debug draws each word's path through its letter centres, as planned", () => {
    const svg = renderToStaticMarkup(
      <RoseSigilImage text="יהוה אל" showRose={false} debug />,
    );
    const layout = roseSigilLayout();
    const anchor = (letter: string) => {
      const a = layout.anchor(letter);
      return `${a.x},${a.y}`;
    };
    // A run is one vertex and a revisit is another, so יהוה's path has
    // four points, the last back at He's centre.
    expect(anchorPaths(svg)).toEqual([
      `M ${anchor("י")} L ${anchor("ה")} L ${anchor("ו")} L ${anchor("ה")}`,
      `M ${anchor("א")} L ${anchor("ל")}`,
    ]);
  });
});
