import { describe, expect, it } from "vitest";
import { contrast, luminance, oklab, oklabDistance } from "./colourContrast";

describe("colour measures", () => {
  it("computes WCAG luminance and contrast", () => {
    expect(luminance("#fff")).toBeCloseTo(1, 10);
    expect(luminance("#000000")).toBe(0);
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrast("#777", "#777")).toBe(1);
    // A WCAG reference pair: #767676 on white is just over 4.5:1.
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("matches Ottosson's OKLab, chroma included", () => {
    const [l, a, b] = oklab("#ff0000");
    expect(l).toBeCloseTo(0.628, 3);
    expect(a).toBeCloseTo(0.2249, 3);
    expect(b).toBeCloseTo(0.1258, 3);
    expect(oklabDistance("#fff", "#fff")).toBe(0);
    expect(oklabDistance("#000", "#ffffff")).toBeCloseTo(1, 3);
  });

  it("refuses a colour that is not hex", () => {
    expect(() => contrast("red", "#fff")).toThrow(/Not a hex colour/);
  });
});
