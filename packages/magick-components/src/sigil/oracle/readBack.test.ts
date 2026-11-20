import { describe, expect, it } from "vitest";
import { roseSigilLayout } from "../../gd/roseSigilLayout.ts";
import { KAMEA_SIGIL_PROFILE, kameaLayout } from "../kameaLayout.ts";
import type { SigilPlan } from "../types.ts";
import { drawPlaced, placeSimply } from "./figureDrawer.ts";
import { HAND_FIXTURES } from "./fixtures.ts";
import { mirroredLayout, scrambleSvg } from "./mutants.ts";
import { checkReadBack, readBack } from "./readBack.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";
import { PLAN_TEMPLATES } from "./templates.ts";

const cases: { id: string; plan: SigilPlan; version: string }[] = [
  ...HAND_FIXTURES.map((f) => ({ id: f.id, plan: f.plan, version: "gd" })),
  ...PLAN_TEMPLATES.map((t) => ({
    id: t.id,
    plan: t.plan,
    version: t.version,
  })),
];

/**
 * Where the simple drawer's naive placement makes ink a reader cannot
 * follow, and read-back is right to refuse it.
 */
const NAIVE_UNREADABLE: Record<string, string> = {
  // א→ל runs back up over א's start circle on the way to ה.
  elohim: "the stroke from ל to ה lies on the first stroke",
  "yhvh-elohim": "as elohim, in the second word",
  "no-place-joiners": "as elohim (א ל ה)",
  "beyond-the-end": "ה→ל lies on the first stroke, through the start circle",
  // A third visit eight units out leaves Aleph's 4.6-unit slack.
  ababa: "the third visit to א is drawn outside its place",
  // Shin lies 1–2 units off Nun→He, so the line turns between 2° and 10°.
  "near-miss": "the turn at ש is too slight to read or to ignore",
  ...Object.fromEntries(
    PLAN_TEMPLATES.flatMap((t): [string, string][] => {
      if (t.id.startsWith("repass-"))
        return [[t.id, "the return's noose is drawn on the start circle"]];
      if (t.id.startsWith("crook-crossed-"))
        return [[t.id, "a stroke runs through the first letter's crook"]];
      if (t.id.startsWith("ababa-"))
        return [[t.id, "the third visit is drawn outside its place"]];
      return [];
    }),
  ),
};

describe("readBack", () => {
  for (const c of cases) {
    const layout = roseSigilLayout(c.version);
    const svg = drawPlaced(placeSimply(c.plan, layout), layout);
    const why = NAIVE_UNREADABLE[c.id];
    if (why)
      it(`refuses ${c.id} drawn naively: ${why}`, () => {
        expect(checkReadBack(svg, c.plan, layout).ok).toBe(false);
      });
    else
      it(`reads ${c.id} back as its plan, however the commands are written`, () => {
        expect(checkReadBack(svg, c.plan, layout).failures).toEqual([]);
        for (const seed of [1, 2, 3])
          expect(
            checkReadBack(scrambleSvg(svg, seed), c.plan, layout).failures,
          ).toEqual([]);
      });
  }

  it("reads Zazel on Saturn's kamea", () => {
    const layout = kameaLayout("saturn");
    const plan = referencePlan(
      referenceWords("זאזל"),
      layout,
      KAMEA_SIGIL_PROFILE,
    );
    const svg = drawPlaced(placeSimply(plan, layout), layout);
    expect(checkReadBack(svg, plan, layout).failures).toEqual([]);
  });

  it("finds no reading in a line drawn back over itself", () => {
    const layout = roseSigilLayout();
    const plan = referencePlan([["א", "ל", "א"]], layout, {
      id: "t",
      nooseTolerance: 1,
    });
    // The return to א drawn on its first visit, as today's ללהאל draws it.
    const svg = drawPlaced(
      placeSimply(plan, layout, [[undefined, undefined, layout.anchor("א")]]),
      layout,
    );
    const result = readBack(svg, layout);
    expect(result.words[0].readings).toEqual([]);
  });

  it("reads a figure against a mirrored rose as other letters", () => {
    const layout = roseSigilLayout();
    const plan = HAND_FIXTURES.find((f) => f.id === "metatron")?.plan ?? [];
    const svg = drawPlaced(placeSimply(plan, layout), layout);
    expect(checkReadBack(svg, plan, mirroredLayout(layout)).ok).toBe(false);
  });
});
