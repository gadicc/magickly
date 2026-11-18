import { describe, expect, it } from "vitest";
import type { Point, SigilPlan, SigilVertex } from "../types.ts";
import { HAND_FIXTURES, KAMEA_FIXTURES } from "./fixtures.ts";
import { checkPlanner, firstDifference, type Planner } from "./o1.ts";
import { referencePlan } from "./referencePlan.ts";
import { PLAN_TEMPLATES } from "./templates.ts";

/** A planner that changes each of the reference's vertices with `change`. */
function altered(
  change: (
    vertex: SigilVertex,
    index: number,
    word: readonly SigilVertex[],
  ) => SigilVertex,
): Planner {
  return (words, layout, profile) =>
    referencePlan(words, layout, profile).map((word) =>
      word.map((vertex, index) => change(vertex, index, word)),
    );
}

const without = (vertex: SigilVertex, mark: string) => ({
  ...vertex,
  marks: vertex.marks.filter((m) => m !== mark),
});

/** Deliberately wrong planners, each a rule misread. */
const MUTANTS: Record<string, Planner> = {
  // Cause 1 of what is wrong today: a repeated first letter goes unseen.
  "drops the crook on a first-letter repeat": altered((vertex, index) =>
    index === 0 && vertex.crooks > 0
      ? { ...without(vertex, "crook"), crooks: 0 }
      : vertex,
  ),
  // A noose for any letter within 6 units of the line.
  "puts nooses with tolerance 6": (words, layout, profile) =>
    referencePlan(words, layout, { ...profile, nooseTolerance: 6 }),
  // Cause 3: a run of three draws one squiggle.
  "draws one crook for a run of three": altered((vertex) =>
    vertex.crooks > 1 ? { ...vertex, crooks: 1 } : vertex,
  ),
  // Cause 5: words joined.
  "joins words": (words, layout, profile) =>
    referencePlan([words.flat()], layout, profile),
  // The figure on p. 60 read literally: no bar on a one-stroke word.
  "leaves the bar off a one-stroke word": altered((vertex, _, word) =>
    word.length === 2 ? without(vertex, "end") : vertex,
  ),
  // Visits counted per letter rather than per vertex.
  "counts visits by letters": (words, layout, profile) =>
    referencePlan(words, layout, profile).map((word) => {
      const seen = new Map<string, number>();
      return word.map((vertex) => {
        const visit = seen.get(vertex.place) ?? 0;
        seen.set(vertex.place, visit + 1 + vertex.crooks);
        return { ...vertex, visit };
      });
    }),
  // Cause 2 and decision 4 reversed: a straight pass outranks the crook.
  "nooses a doubled straight pass": (words, layout, profile) => {
    const plan = referencePlan(words, layout, profile);
    // The same words with every run cut to one letter, so a doubled
    // letter is judged as if single.
    const single = referencePlan(
      words.map((word) =>
        word.filter(
          (token, i) =>
            i === 0 || layout.place(token) !== layout.place(word[i - 1]),
        ),
      ),
      layout,
      profile,
    );
    return plan.map((word, w) =>
      word.map((vertex, i) =>
        vertex.crooks > 0 && single[w][i].marks.includes("noose")
          ? { ...vertex, marks: ["crook", "noose"] as const }
          : vertex,
      ),
    );
  },
  // R4 without the foot: any letter near the line, even beyond an end.
  "ignores where the foot falls": (words, layout, profile) => {
    const near = (p: Point, v: Point, n: Point) => {
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      return (
        Math.abs(dx * (v.y - p.y) - dy * (v.x - p.x)) / Math.hypot(dx, dy) <=
        profile.nooseTolerance * layout.unit
      );
    };
    return referencePlan(words, layout, profile).map((word) =>
      word.map((vertex, i) => {
        if (i === 0 || i === word.length - 1 || vertex.crooks > 0)
          return vertex;
        const [p, n] = [word[i - 1].place, word[i + 1].place];
        if (p === n || vertex.marks.includes("noose")) return vertex;
        return near(
          layout.anchor(p),
          layout.anchor(vertex.place),
          layout.anchor(n),
        )
          ? { ...vertex, marks: ["noose"] as const }
          : vertex;
      }),
    );
  },
};

describe("O1: expected plans", () => {
  it("passes the reference on every hand case and the 72 names", () => {
    expect(checkPlanner(referencePlan)).toEqual([]);
  });

  it("passes the reference over the exhaustive corpus on both roses", () => {
    let calls = 0;
    const counted: Planner = (words, layout, profile) => {
      calls += 1;
      return referencePlan(words, layout, profile);
    };
    const started = performance.now();
    expect(checkPlanner(counted, { exhaustive: true })).toEqual([]);
    // About 0.1 s here; the bound only stops it creeping out of CI.
    expect(performance.now() - started).toBeLessThan(5000);
    const hand =
      HAND_FIXTURES.length + PLAN_TEMPLATES.length + KAMEA_FIXTURES.length;
    expect(calls).toBe(hand + 2 * 72 + 2 * (22 ** 2 + 22 ** 3));
  });

  it("finds what only the exhaustive corpus reaches", () => {
    const tolerance6 = MUTANTS["puts nooses with tolerance 6"];
    const sources = new Set(
      checkPlanner(tolerance6, { exhaustive: true }).map((m) => m.source),
    );
    // A pair has no interior vertex and no fixture's interior vertex is
    // within 6 units of its chord, so only these can differ.
    expect([...sources].sort()).toEqual(["names", "template", "triples"]);
  });

  it.each(Object.entries(MUTANTS))(
    "catches a planner that %s on the hand cases alone",
    (_, mutant) => {
      const mismatches = checkPlanner(mutant, { names: false });
      expect(mismatches.length).toBeGreaterThan(0);
      expect(
        mismatches.every((m) =>
          ["fixture", "template", "kamea"].includes(m.source),
        ),
      ).toBe(true);
    },
  );

  it("catches a planner that splits words wrongly", () => {
    const mismatches = checkPlanner(referencePlan, {
      names: false,
      split: (text) =>
        [Array.from(text.replace(/ /g, ""))].filter((w) => w.length > 0),
    });
    expect(mismatches.map((m) => m.id)).toContain("two-words");
    expect(mismatches.map((m) => m.id)).toContain("yhvh-elohim");
  });

  it("reports a planner that throws, and names the first difference", () => {
    const [first] = checkPlanner(
      () => {
        throw new Error("no");
      },
      { names: false },
    );
    expect(first).toMatchObject({
      source: "fixture",
      id: "metatron",
      difference: "threw: no",
    });
    const plan: SigilPlan = [
      [{ place: "א", visit: 0, crooks: 0, marks: ["start", "end"] }],
    ];
    expect(firstDifference(plan, plan)).toBeNull();
    expect(
      firstDifference(plan, [
        [{ place: "א", visit: 0, crooks: 1, marks: ["start", "end"] }],
      ]),
    ).toBe("word 0, vertex 0: crooks 1, expected 0");
    expect(
      firstDifference(plan, [
        [{ place: "א", visit: 0, crooks: 0, marks: ["end", "start"] }],
      ]),
    ).toBe("word 0, vertex 0: marks [end,start], expected [start,end]");
  });
});
