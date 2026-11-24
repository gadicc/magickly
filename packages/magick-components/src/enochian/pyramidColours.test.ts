import { describe, expect, it } from "vitest";
import { PYRAMID_SYMBOL_INKS } from "./pyramidMarks.tsx";
import { PYRAMID_COLOURS } from "./Tablet.tsx";

/** WCAG's relative luminance of a "#rrggbb" colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number)
  );
}

/** WCAG's contrast ratio of two colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

describe("the pyramid's symbols against their sides", () => {
  it("has inks for every side's colour, and no more", () => {
    expect(Object.keys(PYRAMID_SYMBOL_INKS).sort()).toEqual(
      Object.keys(PYRAMID_COLOURS).sort(),
    );
  });

  it("stand out by their outline at 3:1 or more, whatever their own colour", () => {
    for (const [side, { outline }] of Object.entries(PYRAMID_SYMBOL_INKS))
      expect(
        contrast(
          outline,
          PYRAMID_COLOURS[side as keyof typeof PYRAMID_COLOURS],
        ),
        side,
      ).toBeGreaterThanOrEqual(3);
  });

  it("measures the complements the outline makes up for", () => {
    expect(
      contrast(PYRAMID_SYMBOL_INKS.fire.ink, PYRAMID_COLOURS.fire),
    ).toBeLessThan(3);
    expect(
      contrast(PYRAMID_SYMBOL_INKS.water.ink, PYRAMID_COLOURS.water),
    ).toBeLessThan(3);
  });
});
