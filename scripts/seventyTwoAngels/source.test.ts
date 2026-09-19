import { describe, expect, it } from "vitest";
import { findRegions, readSource } from "./source";

const lines = readSource();
const regions = findRegions(lines);

describe("reading the scan", () => {
  it("takes only the first of the two identical copies", () => {
    // The sidecar holds the book twice; the second copy repeats the first
    // exactly, so a naive read would find every heading twice.
    const whole = readSource().length;
    expect(whole).toBe(6503);
    expect(lines.filter((line) => /Vehuiah/.test(line)).length).toBe(1);
  });
});

describe("cutting it into genii", () => {
  it("finds all seventy-two, in order", () => {
    expect(regions.map((r) => r.no)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    // A genius whose heading was lost shares its predecessor's start, so the
    // sequence advances without ever going backwards.
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i].from).toBeGreaterThanOrEqual(regions[i - 1].from);
      if (regions[i].headingFound)
        expect(regions[i].from).toBeGreaterThan(regions[i - 1].from);
    }
  });

  it("gives every genius something to work with", () => {
    for (const region of regions) {
      expect(region.to).toBeGreaterThan(region.from);
      expect(region.french.length).toBeGreaterThan(800);
    }
  });

  it("reads the headings the scan mangled", () => {
    // "369." for the 46th, "g1€." for the 51st, "J;e." for the 53rd, "645."
    // for the 54th, and a stray apostrophe before the 47th.
    for (const no of [46, 47, 51, 53, 54])
      expect(regions[no - 1].headingFound).toBe(true);
  });

  it("admits the two headings the scan lost", () => {
    // 22's opening line vanished at a page break; 42's says "Les cabalistes
    // lui donnent les attributs suivants" and breaks "attri-" across lines.
    expect(regions.filter((r) => !r.headingFound).map((r) => r.no)).toEqual([
      22, 42,
    ]);
  });

  it("widens the region where a heading is missing", () => {
    // 22 must still be inside its region, between 21 and 23.
    expect(regions[21].french).toContain("Nelchael");
    expect(regions[21].french).toContain("Melahel");
    expect(regions[41].french).toContain("Mikael");
  });

  it("starts and ends where the chapter does", () => {
    expect(regions[0].french).toContain("Vehuiah");
    expect(regions[71].french).toContain("Mumiah");
  });
});
