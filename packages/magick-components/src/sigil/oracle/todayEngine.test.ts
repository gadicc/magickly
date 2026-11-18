/**
 * The S1 gate (plan 088): the oracle flags every row of "What is wrong
 * today" on today's engine. These tests pass while the oracle catches
 * today's faults; they record today's state, not what is right, and go
 * away with the optimiser in S2. Expected plans come from the reference
 * planner with `ROSE_SIGIL_PROFILE`.
 */

import { describe, expect, it } from "vitest";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { SEVENTY_TWO_NAMES } from "./corpus.ts";
import { checkInvariants, checkStability } from "./invariants.ts";
import { checkReadBack } from "./readBack.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";
import { drawToday, drawTodayAsPage } from "./todayEngine.ts";

const rose = roseSigilLayout();
const plan = (text: string) =>
  referencePlan(referenceWords(text), rose, ROSE_SIGIL_PROFILE);

async function judge(text: string) {
  const svg = await drawTodayAsPage(text);
  const p = plan(text);
  return {
    o2: checkInvariants(svg, p, rose),
    o3: checkReadBack(svg, p, rose),
  };
}

/**
 * The 72 names today's page draws so that they pass O2 and O3 as drawn,
 * measured 18 November 2026; every one still fails the 1-ulp check.
 */
const TODAY_PASSING = [
  "יליאל",
  "עלמיה",
  "אכאיה",
  "כהתאל",
  "לכבאל",
  "אניאל",
  "רהעאל",
  "עריאל",
  "ניתאל",
  "מצראל",
  "ומבאל",
  "ענואל",
  "דמביה",
  "מנקאה",
];

describe("today's engine, against plan 088's 'What is wrong today'", () => {
  for (const name of ["ללהאל", "יייאל", "ננאאל"])
    it(`${name}: the repeated first letter has no crook`, async () => {
      const { o2, o3 } = await judge(name);
      const first = plan(name)[0][0].place;
      expect(o2).toContainEqual(
        expect.objectContaining({ check: "crook", place: first }),
      );
      expect(o3.ok).toBe(false);
    });

  it("הההאל: a blob of arcs, not two crooks", async () => {
    const { o2, o3 } = await judge("הההאל");
    expect(o2).toContainEqual(
      expect.objectContaining({ check: "crook", place: "ה" }),
    );
    expect(o2.map((f) => f.check)).toContain("shape");
    expect(o3.failures.map((f) => f.message).join()).toMatch(
      /neither loops nor cups/,
    );
  });

  it("ללהאל: one line drawn up and back over itself", async () => {
    const { o2, o3 } = await judge("ללהאל");
    expect(o2.map((f) => f.check)).toContain("overlap");
    expect(o3.readBack.words[0].readings).toEqual([]);
  });

  it("יהוה אלהים: one path, not two sigils", async () => {
    const { o2, o3 } = await judge("יהוה אלהים");
    expect(o2.map((f) => f.check)).toContain("words");
    expect(o3.failures.map((f) => f.message)).toContain(
      "1 word(s) drawn, 2 planned",
    );
  });

  it("יבמיה: a bead at Beth's 133° corner", async () => {
    const { o2, o3 } = await judge("יבמיה");
    expect(o2).toEqual([
      expect.objectContaining({ check: "shape", place: "ב" }),
      expect.objectContaining({ check: "shape", place: "ב" }),
      expect.objectContaining({ check: "shape", place: "ב" }),
    ]);
    expect(o3.ok).toBe(false);
  });

  it("מומיה: agrees with decision 2, no noose at Mem at 1 unit", async () => {
    // The optimiser bends the 162° pass to 139°, which a 1-unit tolerance
    // also leaves a plain corner; it reads back right. O2 still finds the
    // last stroke, Yod to He, running 0.8 units from the centre of Mem's
    // start circle, through its ink.
    const { o2, o3 } = await judge("מומיה");
    expect(o2.filter((f) => f.check === "noose")).toEqual([]);
    expect(o2.map((f) => [f.check, f.place])).toEqual([
      ["clearance", "מ"],
      ["clearance", "מ"],
    ]);
    expect(o3.ok).toBe(true);
  });

  it("records which of the 72 pass O2 and O3 as the page draws them", async () => {
    const passing: string[] = [];
    for (const { text } of SEVENTY_TWO_NAMES) {
      const { o2, o3 } = await judge(text);
      if (o2.length === 0 && o3.ok) passing.push(text);
    }
    expect(passing).toEqual(TODAY_PASSING);
  });

  it("changes every one of the 72 under a one-ulp nudge of the anchors", async () => {
    // Plan 088 measured 63 of 72 nudging unrounded letter centres; from
    // the layout's anchors, rounded to 0.001, every name changes.
    const unstable: string[] = [];
    for (const { text } of SEVENTY_TWO_NAMES)
      if (!(await checkStability(drawToday, text, rose)).stable)
        unstable.push(text);
    expect(unstable).toHaveLength(SEVENTY_TWO_NAMES.length);
  });
});
