import { describe, expect, it } from "vitest";
import { roseSigilLayout } from "../../gd/roseSigilLayout.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";

const layout = roseSigilLayout();
const profile = { id: "test", nooseTolerance: 1 };
const plan = (text: string) =>
  referencePlan(referenceWords(text), layout, profile);

describe("referencePlan", () => {
  it("marks Metatron's doubled Teth with a crook and Resh with a noose", () => {
    expect(plan("מטטרון")).toEqual([
      [
        { place: "מ", visit: 0, crooks: 0, marks: ["start"] },
        { place: "ט", visit: 0, crooks: 1, marks: ["crook"] },
        { place: "ר", visit: 0, crooks: 0, marks: ["noose"] },
        { place: "ו", visit: 0, crooks: 0, marks: [] },
        { place: "נ", visit: 0, crooks: 0, marks: ["end"] },
      ],
    ]);
  });

  it("splits words, counts revisits and gives a one-letter word both ends", () => {
    expect(plan("  יהוה\tא ")).toEqual([
      [
        { place: "י", visit: 0, crooks: 0, marks: ["start"] },
        { place: "ה", visit: 0, crooks: 0, marks: [] },
        { place: "ו", visit: 0, crooks: 0, marks: [] },
        { place: "ה", visit: 1, crooks: 0, marks: ["end"] },
      ],
      [{ place: "א", visit: 0, crooks: 0, marks: ["start", "end"] }],
    ]);
  });

  it("merges a run of three into one vertex with two crooks, start included", () => {
    expect(plan("הההאל")[0][0]).toEqual({
      place: "ה",
      visit: 0,
      crooks: 2,
      marks: ["start", "crook"],
    });
  });

  it("drops what the rose has no place for, and words left empty", () => {
    expect(plan("abc ךְ!")).toEqual([
      [{ place: "כ", visit: 0, crooks: 0, marks: ["start", "end"] }],
    ]);
  });
});
