import { describe, expect, it } from "vitest";
import theme from "./theme";

/** WCAG 2 relative luminance of a `#rgb` or `#rrggbb` colour. */
function luminance(hex: string) {
  const digits = hex.replace("#", "");
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  expect(full, hex).toMatch(/^[0-9a-f]{6}$/i);
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = Number.parseInt(full.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours. */
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("the rubric colour (plan 089, decision 1)", () => {
  it.each(["light", "dark"] as const)(
    "reads at 4.5:1 or more on the %s surface and on the reader's own tint",
    (scheme) => {
      const ritual = theme.colorSchemes[scheme]?.palette.ritual;
      expect(ritual).toBeDefined();
      const { rubric, surface, selfAction } = ritual!;
      expect(contrast(rubric, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rubric, selfAction)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("is the settled light rubric, about 6.8:1 on the surface", () => {
    const ritual = theme.colorSchemes.light?.palette.ritual;
    expect(ritual?.rubric).toBe("#8a3324");
    expect(contrast(ritual!.rubric, ritual!.surface)).toBeCloseTo(6.8, 1);
  });

  it("computes WCAG contrast", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrast("#777", "#777")).toBe(1);
  });
});
