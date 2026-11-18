import { describe, expect, it } from "vitest";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "../gd/roseSigilLayout.ts";
import { checkPlanner } from "./oracle/o1.ts";
import { planSigil, sigilWords } from "./planSigil.ts";

describe("planSigil (O1)", () => {
  it("matches every hand plan and the reference over the exhaustive corpus", () => {
    expect(checkPlanner(planSigil, { exhaustive: true })).toEqual([]);
  });

  it("matches them with its own split too", () => {
    expect(
      checkPlanner(planSigil, { exhaustive: true, split: sigilWords }),
    ).toEqual([]);
  });

  it("splits on whitespace only", () => {
    expect(sigilWords(" יהוה אלהים א-ב־ג ")).toEqual([
      ["י", "ה", "ו", "ה"],
      ["א", "ל", "ה", "י", "ם"],
      ["א", "-", "ב", "־", "ג"],
    ]);
    expect(sigilWords("   ")).toEqual([]);
  });

  it("drops a word with no places", () => {
    const rose = roseSigilLayout();
    expect(planSigil(sigilWords("abc א"), rose, ROSE_SIGIL_PROFILE)).toEqual([
      [{ place: "א", visit: 0, crooks: 0, marks: ["start", "end"] }],
    ]);
  });
});
