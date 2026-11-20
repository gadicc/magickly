import { describe, expect, it } from "vitest";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { KAMEA_SIGIL_PROFILE, kameaLayout } from "../kameaLayout.ts";
import type { SigilLayout, SigilPlan } from "../types.ts";
import { drawPlaced, placeSimply } from "./figureDrawer.ts";
import { HAND_FIXTURES } from "./fixtures.ts";
import {
  checkInvariants,
  checkStability,
  type InvariantCheck,
  nextDouble,
} from "./invariants.ts";
import { scrambleSvg, zazelOnSaturn } from "./mutants.ts";
import { checkReadBack } from "./readBack.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";
import { PLAN_TEMPLATES } from "./templates.ts";

const rose = roseSigilLayout();
const plan = (text: string, layout = rose) =>
  referencePlan(referenceWords(text), layout, ROSE_SIGIL_PROFILE);
const checks = (svg: string, p: SigilPlan, layout = rose) =>
  [...new Set(checkInvariants(svg, p, layout).map((f) => f.check))].sort();
const drawSimply = (text: string, layout: SigilLayout<string>) =>
  drawPlaced(placeSimply(plan(text, layout), layout), layout);

const cases = [
  ...HAND_FIXTURES.map((f) => ({ id: f.id, plan: f.plan, version: "gd" })),
  ...PLAN_TEMPLATES.map((t) => ({
    id: t.id,
    plan: t.plan,
    version: t.version,
  })),
];

/**
 * Where the simple drawer's naive placement (anchors, a fixed sideways
 * offset for revisits) breaks an invariant, and O2 is right to say so.
 */
const NAIVE_BREAKS: Record<string, InvariantCheck[]> = {
  // The simple drawer settles nooses one at a time, so a run of them bends
  // (O2's "not on an unbent line"), and leaves a return up a run's line
  // where it falls.
  "noose-run-במכק": ["noose"],
  "noose-run-גשפו": ["noose"],
  "noose-run-במכקי": ["clearance", "noose"],
  "noose-run-ההאדלה": ["clearance", "overlap"],
  "noose-run-בבמכק": ["noose"],
  "noose-run-אבמכקש": ["clearance", "noose", "overlap"],
  "noose-run-לגשפוה": ["noose"],
  elohim: [
    "bar-clearance",
    "clearance",
    "noose",
    "overlap",
    "slack",
    "start-circle",
  ],
  "yhvh-elohim": [
    "bar-clearance",
    "clearance",
    "noose",
    "overlap",
    "slack",
    "start-circle",
  ],
  "no-place-joiners": ["noose", "overlap", "slack", "start-circle"],
  "beyond-the-end": ["noose", "overlap", "slack", "start-circle"],
  "repeat-middle-2-נ": ["clearance", "overlap"],
  "repeat-middle-3-נ": ["clearance", "overlap"],
  aba: ["overlap"],
  abab: ["overlap"],
  ababa: ["bar", "clearance", "overlap", "slack"],
  "visits-count-vertices": ["overlap"],
  "crook-on-revisit": ["overlap"],
  "foot-outside": ["clearance", "overlap"],
  // The return's noose lands on the start circle; V‑P‑V‑N also runs back
  // over the first stroke.
  ...Object.fromEntries(
    PLAN_TEMPLATES.filter((t) => t.id.startsWith("repass-vpvn-")).map((t) => [
      t.id,
      ["clearance", "loop-clearance", "noose", "overlap", "start-circle"],
    ]),
  ),
  ...Object.fromEntries(
    PLAN_TEMPLATES.filter((t) => t.id.startsWith("repass-vxpvn-")).map((t) => [
      t.id,
      ["loop-clearance"],
    ]),
  ),
  "crook-crossed-מממדתב": ["crook-clearance"],
  "crook-crossed-כככוההגג": ["crook-clearance"],
  "crook-crossed-וווגוכהז": ["crook-clearance", "overlap"],
  // Visits 4 units apart, the third outside the slack.
  "ababa-פל": ["bar", "clearance", "overlap", "slack"],
  "ababa-הו": ["bar", "clearance", "slack"],
  "ababa-שמ": ["bar", "clearance", "slack"],
  "ababa-טצ": ["bar", "clearance", "overlap", "slack"],
};

describe("checkInvariants", () => {
  for (const c of cases) {
    const layout = roseSigilLayout(c.version);
    const svg = drawPlaced(placeSimply(c.plan, layout), layout);
    const expected = NAIVE_BREAKS[c.id] ?? [];
    it(`finds ${expected.length ? expected.join(", ") : "nothing"} in ${c.id} drawn simply, however the commands are written`, () => {
      expect(checks(svg, c.plan, layout)).toEqual(expected);
      expect(checks(scrambleSvg(svg, 5), c.plan, layout)).toEqual(expected);
    });
  }

  it("passes ללהאל placed by hand: the worst case is feasible", () => {
    // Two strokes and a noose within the slack at Aleph (plan 088, S1):
    // He and both Lameds at the edge of their 4.6-unit slack, Aleph on the
    // line from He to the second Lamed, its noose away from the first stroke.
    const p = plan("ללהאל");
    const he = { x: 0, y: -30.45 };
    const lamed = { x: 4.488, y: 34.7 };
    const lamed2 = { x: -4.488, y: 34.7 };
    const t = (-15 - he.y) / (lamed2.y - he.y);
    const aleph = { x: he.x + (lamed2.x - he.x) * t, y: -15 };
    const svg = drawPlaced(
      placeSimply(p, rose, [[lamed, he, aleph, lamed2]]),
      rose,
      {},
      { nooseRight: [{ word: 0, vertex: 2 }] },
    );
    expect(checkInvariants(svg, p, rose)).toEqual([]);
    expect(checkReadBack(svg, p, rose).failures).toEqual([]);
    // The same figure with the noose towards the first stroke touches it.
    const crowded = drawPlaced(
      placeSimply(p, rose, [[lamed, he, aleph, lamed2]]),
      rose,
    );
    expect(checks(crowded, p, rose)).toEqual(["clearance"]);
  });

  it("passes Zazel on Saturn's kamea", () => {
    const { svg, plan: p, layout } = zazelOnSaturn();
    expect(checkInvariants(svg, p, layout)).toEqual([]);
  });

  it("bounds a kamea's ink by its square, not the disc round it", () => {
    // Zayin 7 to Daleth 4, Saturn's top left corner, drawn 2 units past
    // the square's side: inside the disc that would reach the corners.
    const layout = kameaLayout("saturn");
    const p = referencePlan(referenceWords("זד"), layout, KAMEA_SIGIL_PROFILE);
    const corner = layout.anchor("0,0");
    const out = { x: -48 - 2 * layout.unit, y: corner.y };
    expect(Math.hypot(out.x, out.y)).toBeLessThan(48 * Math.SQRT2);
    const svg = drawPlaced(placeSimply(p, layout, [[undefined, out]]), layout);
    expect(checkInvariants(svg, p, layout).map((f) => f.check)).toContain(
      "outer-ring",
    );
  });

  it("holds marks to the grammar's sizes", () => {
    const p = plan("מטטרון");
    const svg = drawSimply("מטטרון", rose);
    const small = drawPlaced(
      placeSimply(p, rose),
      rose,
      {},
      {
        sizes: {
          startRadius: 0.5,
          nooseRadius: 0.5,
          cupChord: 1,
          cupDepth: 0.5,
        },
      },
    );
    expect(checks(small, p, rose)).toEqual(["crook", "noose", "start-circle"]);
    // A bar turned off perpendicular.
    const skewed = svg.replace(
      /M ([-\d.]+),([-\d.]+) L ([-\d.]+),([-\d.]+)"/,
      (_, x1, y1, x2, y2) =>
        `M ${x1},${Number(y1) + 1} L ${x2},${Number(y2) - 1}"`,
    );
    expect(checks(skewed, p, rose)).toContain("bar");
  });

  it("keeps every mark inside the outer ring and every word in its region", () => {
    const p = plan("בינה");
    const svg = drawSimply("בינה", rose);
    expect(
      checks(svg.replace("</svg>", `<path d="M 0,0 L 0,44"/></svg>`), p, rose),
    ).toContain("outer-ring");
    expect(
      checks(svg.replace("</svg>", `<path d="M 30,0 L 60,0"/></svg>`), p, rose),
    ).toContain("words");
    expect(checks(svg, plan("בינה אל"), rose)).toContain("words");
  });

  it("refuses plans outside the grammar's domain", () => {
    const p = plan("שלללל");
    expect(checks(drawSimply("שלללל", rose), p, rose)).toContain("domain");
  });
});

describe("checkStability", () => {
  it("moves a double by one ulp, and zero by one ulp of the unit", () => {
    expect(nextDouble(1, 1)).toBe(1 + Number.EPSILON);
    expect(nextDouble(-35, 1)).toBeGreaterThan(-35);
    expect(nextDouble(nextDouble(17.5, -1), 1)).toBe(17.5);
  });

  it("passes the simple drawer, which quantises its inputs", async () => {
    for (const text of ["מטטרון", "יהוה", "אגיאל", "יוד הא ואו הא"])
      expect(await checkStability(drawSimply, text, rose)).toEqual({
        stable: true,
        changed: [],
      });
  });

  it("fails a drawing that writes its anchors unrounded", async () => {
    const raw = (text: string, layout: SigilLayout<string>) =>
      plan(text, layout)
        .flat()
        .map((v) => `${layout.anchor(v.place).x},${layout.anchor(v.place).y}`)
        .join(" ");
    expect(await checkStability(raw, "בינה", rose)).toEqual({
      stable: false,
      changed: ["up", "down", "alternating"],
    });
  });
});
