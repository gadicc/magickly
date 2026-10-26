import { describe, expect, it } from "vitest";
import { GD_HALL_SLUGS, gdHall } from "@/render/contracts/gdHall";
import { HALL_LEADS } from "./hallLeads";

describe("the temple halls' leads", () => {
  it("gives every hall a lead of a few sentences, in our own words", () => {
    expect(Object.keys(HALL_LEADS)).toEqual([...GD_HALL_SLUGS]);
    for (const slug of GD_HALL_SLUGS) {
      const { lead, sources } = HALL_LEADS[slug];
      expect(lead).toContain(gdHall(slug)?.grade);
      expect(lead.length).toBeGreaterThan(100);
      expect(lead.length).toBeLessThanOrEqual(400);
      expect(lead.split(". ").length).toBeLessThanOrEqual(3);
      // Nothing quoted: no book's text is reproduced. Nor the drawings
      // the presets replaced, which readers have never seen.
      for (const text of [lead, sources ?? ""]) {
        expect(text).not.toMatch(/["“”]/);
        expect(text).not.toMatch(/older|our drawing/i);
      }
    }
  });

  it("says what a preset follows only where its sources disagree", () => {
    expect(
      GD_HALL_SLUGS.filter((slug) => HALL_LEADS[slug].sources === undefined),
    ).toEqual(["theoricus-1", "theoricus-2"]);
  });
});
