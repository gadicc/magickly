import { describe, expect, it } from "vitest";
import fontMetrics from "./fontMetrics.json";
import {
  compassFont,
  hebrewLetterBody,
  LABEL_SIZE,
  labelFont,
  MAX_LABEL_LINES,
  textMeasure,
  wrapText,
} from "./labels";

/** The dais lamen's width at its drawing scale: the label box. */
const DAIS = 2.31;

describe("the generated font metrics", () => {
  it("loads the label font's kern pairs as HarfBuzz shapes them", () => {
    // Pair adjustments read from HarfBuzz 14.5.1 on the shipped subset.
    for (const [pair, units] of [
      ["AV", -80],
      ["Te", -30],
      ["Yo", -70],
      ["P,", -120],
      ["LT", -70],
      ["r,", -170],
      ["Àv", -50],
      ["ÿ.", -90],
      ["f.", 0],
      ["ab", 0],
    ] as const)
      expect(labelFont.kerning(pair[0], pair[1]), pair).toBe(units);
    expect(fontMetrics.label.upem).toBe(1000);
    expect(fontMetrics.source).toBe(
      "google/fonts@8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5",
    );
  });

  it("matches the spike's HarfBuzz widths at the default label size", () => {
    // spike/wrap-results.txt and compare-widths.txt (Chromium within 0.0092 %).
    for (const [text, width] of [
      ["Imperator", 2.0511],
      ["Hierophant", 2.29362],
      ["Praemonstrator", 3.21554],
      ["Past Hierophant", 3.27875],
      ["Neophyte Temple", 3.43183],
      ["Cancellarius", 2.49701],
    ] as const)
      expect(labelFont.width(text, LABEL_SIZE), text).toBeCloseTo(width, 5);
    expect(LABEL_SIZE).toBe(0.43);
  });

  it("measures characters outside the subset with an average advance", () => {
    expect(labelFont.width("Ω", 1)).toBeCloseTo(0.55, 5);
    expect(labelFont.width("", 1)).toBe(0);
  });

  it("gives letter extents for spacing", () => {
    expect(labelFont.top).toBeCloseTo(0.77, 2);
    expect(labelFont.bottom).toBeCloseTo(0.24, 2);
    expect(compassFont.width("East", 1)).toBeGreaterThan(1);
    expect(hebrewLetterBody.top).toBeGreaterThan(0.5);
    expect(hebrewLetterBody.bottom).toBe(0);
  });

  it("measures any table, ignoring a trailing odd entry", () => {
    const font = textMeasure({
      upem: 100,
      capHeight: 70,
      letterTop: 80,
      letterBottom: -20,
      advances: [65, 50, 86, 60, 99],
      kernLeft: [65, 1],
      kernRight: [86, 1],
      kern: [1, 1, -10, 7],
    });
    expect(font.width("AV", 1)).toBeCloseTo(1, 10);
    expect(font.width("VA", 1)).toBeCloseTo(1.1, 10);
    expect(font.kerning("A", "V")).toBe(-10);
    expect(font.top).toBe(0.8);
    expect(font.bottom).toBe(0.2);
  });
});

describe("wrapText", () => {
  const texts = (text: string, width = DAIS) =>
    wrapText(text, width, LABEL_SIZE).map((line) => line.text);

  it("wraps at spaces, as the plan's label examples do", () => {
    expect(texts("Past Hierophant")).toEqual(["Past", "Hierophant"]);
    expect(texts("Banner of the West")).toEqual(["Banner of", "the West"]);
    expect(texts("Neophyte Temple")).toEqual(["Neophyte", "Temple"]);
    expect(texts("Chief Adept")).toEqual(["Chief Adept"]);
    expect(texts("Third Adept")).toEqual(["Third", "Adept"]);
  });

  it("keeps Hierophant on one line with 0.016 square to spare", () => {
    const [line] = wrapText("Hierophant", DAIS, LABEL_SIZE);
    expect(DAIS - line.width).toBeCloseTo(0.0164, 4);
  });

  it("lets a single long word overflow on one line", () => {
    const lines = wrapText("Praemonstrator", DAIS, LABEL_SIZE);
    expect(lines).toHaveLength(1);
    expect(lines[0].width).toBeGreaterThan(DAIS);
    expect(texts("Cancellarius")).toEqual(["Cancellarius"]);
    expect(texts("Past Praemonstrator")).toEqual(["Past", "Praemonstrator"]);
  });

  it("cuts text to six lines, the last ending in an ellipsis", () => {
    const lines = wrapText("a ".repeat(100), 0.1, LABEL_SIZE);
    expect(MAX_LABEL_LINES).toBe(6);
    expect(lines.map((line) => line.text)).toEqual([
      "a",
      "a",
      "a",
      "a",
      "a",
      "a…",
    ]);
    expect(lines.map((line) => line.truncated)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    ]);
    expect(lines[5].width).toBeCloseTo(labelFont.width("a…", LABEL_SIZE), 10);
    expect(texts("1\n2\n3\n4\n5\n6")).toHaveLength(6);
    expect(wrapText("1\n2\n3\n4\n5\n6", 10, 1).at(-1)?.truncated).toBe(
      undefined,
    );
    expect(texts("1\n2\n3\n4\n5\n6\n7").at(-1)).toBe("6…");
    expect(
      wrapText("one two three", 0.1, LABEL_SIZE, labelFont, 2).map(
        (line) => line.text,
      ),
    ).toEqual(["one", "two…"]);
  });

  it("collapses spaces, honours line breaks and drops empty text", () => {
    expect(texts("  Past   Hierophant ", 10)).toEqual(["Past Hierophant"]);
    expect(texts("Past\nHierophant", 10)).toEqual(["Past", "Hierophant"]);
    expect(texts("")).toEqual([]);
    expect(texts(" \n ")).toEqual([]);
  });
});
