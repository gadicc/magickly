import { describe, expect, it } from "vitest";
import { confirmsRitualTitle } from "./ritualTitleMatch";

describe("confirmsRitualTitle", () => {
  it("accepts the exact title", () => {
    expect(
      confirmsRitualTitle("Zelator 1=10 (sample)", "Zelator 1=10 (sample)"),
    ).toBe(true);
  });

  it("compares in NFC, so a decomposed é matches a precomposed one", () => {
    const precomposed = "Café rite (sample)";
    const decomposed = "Café rite (sample)";
    expect(precomposed).not.toBe(decomposed);
    expect(confirmsRitualTitle(decomposed, precomposed)).toBe(true);
    expect(confirmsRitualTitle(precomposed, decomposed)).toBe(true);
  });

  it("counts tabs, newlines and runs of spaces as one space, and trims", () => {
    const title = "Neophyte  0=0\t(sample)";
    expect(confirmsRitualTitle("Neophyte 0=0 (sample)", title)).toBe(true);
    expect(confirmsRitualTitle(" Neophyte\n0=0   (sample)\t", title)).toBe(
      true,
    );
    expect(confirmsRitualTitle("Neophyte0=0 (sample)", title)).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(
      confirmsRitualTitle("zelator 1=10 (sample)", "Zelator 1=10 (sample)"),
    ).toBe(false);
    expect(
      confirmsRitualTitle("ZELATOR 1=10 (SAMPLE)", "Zelator 1=10 (sample)"),
    ).toBe(false);
  });

  it("never matches an empty or blank title", () => {
    expect(confirmsRitualTitle("", "")).toBe(false);
    expect(confirmsRitualTitle(" ", " \t\n")).toBe(false);
    expect(confirmsRitualTitle("", "Zelator 1=10 (sample)")).toBe(false);
  });
});
