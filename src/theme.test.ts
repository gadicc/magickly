import { describe, expect, it } from "vitest";
import { contrast } from "./colourContrast";
import theme from "./theme";

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
});
