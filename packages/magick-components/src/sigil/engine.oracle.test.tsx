/**
 * The sigil engine against plan 088's oracle: planned by `planSigil`,
 * placed by `placeSigil` and drawn by `SigilImage`, every figure of the
 * corpus must pass O2 (invariants) and O3 (read-back), and the same
 * drawing must come out when every anchor moves by one ulp. O1 (the plans
 * alone) is `planSigil.test.ts`.
 *
 * The whole corpus runs here, in CI: the hand fixtures, the templates, the
 * 72 names, every pair and triple of letters, a seeded random corpus of 4-
 * to 12-letter words and every A-B-A-B-A word, each on both roses (the
 * last on Regardie's only where it differs); the kameas' corpus is
 * `kamea.oracle.test.tsx`. `KNOWN_FAILURES`
 * (`oracle/engineKnownFailures.ts`) lists the figures the engine is known
 * to draw wrongly, with the checks each fails, and may only shrink.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "../gd/roseSigilLayout.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import { roseUnroundedAnchor } from "./oracle/anchors.ts";
import {
  ababaTexts,
  CORPUS_ROSE_VERSIONS,
  collinearRunTexts,
  DOMAIN_EDGE_TEXTS,
  randomRoseTexts,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "./oracle/corpus.ts";
import { ENGINE_KNOWN_FAILURES } from "./oracle/engineKnownFailures.ts";
import { HAND_FIXTURES } from "./oracle/fixtures.ts";
import { checkInvariants, checkStability } from "./oracle/invariants.ts";
import { mirroredLayout } from "./oracle/mutants.ts";
import { checkReadBack } from "./oracle/readBack.ts";
import { referencePlan, referenceWords } from "./oracle/referencePlan.ts";
import { PLAN_TEMPLATES } from "./oracle/templates.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import { SigilImage } from "./SigilImage.tsx";
import type { SigilLayout, SigilPlan } from "./types.ts";

/** Figures the engine draws wrongly, by version and text, with the checks each fails. */
const KNOWN_FAILURES: Readonly<Record<string, string>> = ENGINE_KNOWN_FAILURES;

/** `text` drawn by the engine on a rose layout, as the image route would. */
const draw = (text: string, layout: SigilLayout<string>): string =>
  renderToStaticMarkup(
    <SigilImage text={text} layout={layout} profile={ROSE_SIGIL_PROFILE} />,
  );

/** What O2 and O3 say of `svg`, in one line each; empty when it passes. */
function judge(
  svg: string,
  plan: SigilPlan,
  layout: SigilLayout<string>,
): string[] {
  return [
    ...checkInvariants(svg, plan, layout).map(
      (f) => `O2 ${f.check}: ${f.message}`,
    ),
    ...checkReadBack(svg, plan, layout).failures.map((f) => `O3: ${f.message}`),
  ];
}

/** The checks `svg` fails, as `KNOWN_FAILURES` names them; empty when it passes. */
function checksFailed(
  svg: string,
  plan: SigilPlan,
  layout: SigilLayout<string>,
): string {
  const checks: string[] = [
    ...new Set(checkInvariants(svg, plan, layout).map((f) => f.check)),
  ].sort();
  if (!checkReadBack(svg, plan, layout).ok) checks.push("O3");
  return checks.join(" ");
}

/** The texts of `cases` that fail O2 or O3, with the checks they fail. */
function failing(
  cases: Iterable<{ text: string; version: string }>,
): Record<string, string> {
  const failed: Record<string, string> = {};
  for (const { text, version } of cases) {
    const layout = roseSigilLayout(version);
    const plan = planSigil(sigilWords(text), layout, ROSE_SIGIL_PROFILE);
    const checks = checksFailed(draw(text, layout), plan, layout);
    if (checks) failed[`${version} ${text}`] = checks;
  }
  return failed;
}

const expectedFailures = (version: string, texts: Iterable<string>) => {
  const wanted = new Set([...texts].map((text) => `${version} ${text}`));
  return Object.fromEntries(
    Object.entries(KNOWN_FAILURES).filter(([key]) => wanted.has(key)),
  );
};

describe("the engine against O2 and O3", () => {
  it("draws every hand fixture as its plan", () => {
    const cases = HAND_FIXTURES.map((f) => ({ text: f.text, version: "gd" }));
    expect(failing(cases)).toEqual(
      expectedFailures(
        "gd",
        cases.map((c) => c.text),
      ),
    );
    // The figures' plans are the hand-written ones, not just the planner's.
    for (const fixture of HAND_FIXTURES) {
      const rose = roseSigilLayout();
      expect([
        fixture.id,
        checksFailed(draw(fixture.text, rose), fixture.plan, rose),
      ]).toEqual([fixture.id, KNOWN_FAILURES[`gd ${fixture.text}`] ?? ""]);
    }
  });

  it("draws every template as its plan", () => {
    for (const template of PLAN_TEMPLATES) {
      const layout = roseSigilLayout(template.version);
      expect([
        template.id,
        checksFailed(draw(template.text, layout), template.plan, layout),
      ]).toEqual([
        template.id,
        KNOWN_FAILURES[`${template.version} ${template.text}`] ?? "",
      ]);
    }
  });

  for (const version of CORPUS_ROSE_VERSIONS)
    it(`draws the 72 names on the ${version} rose`, () => {
      const texts = SEVENTY_TWO_NAMES.map((n) => n.text);
      expect(failing(texts.map((text) => ({ text, version })))).toEqual(
        expectedFailures(version, texts),
      );
    });

  for (const version of CORPUS_ROSE_VERSIONS)
    it(`draws every pair and triple of letters on the ${version} rose`, () => {
      const texts = [...roseTexts(2, version), ...roseTexts(3, version)];
      expect(texts).toHaveLength(22 ** 2 + 22 ** 3);
      expect(failing(texts.map((text) => ({ text, version })))).toEqual(
        expectedFailures(version, texts),
      );
    }, 60_000);

  // Words of 4 to 12 letters within the grammar's domain, from a fixed
  // seed, and four-visit words at its edge.
  const random = [...randomRoseTexts(), ...DOMAIN_EDGE_TEXTS];
  for (const version of CORPUS_ROSE_VERSIONS)
    it(`plans and draws ${random.length} random words on the ${version} rose`, () => {
      const layout = roseSigilLayout(version);
      // O1: the planner against the blind reference.
      const misplanned = random.filter(
        (text) =>
          JSON.stringify(
            planSigil(sigilWords(text), layout, ROSE_SIGIL_PROFILE),
          ) !==
          JSON.stringify(
            referencePlan(referenceWords(text), layout, ROSE_SIGIL_PROFILE),
          ),
      );
      expect(misplanned).toEqual([]);
      expect(failing(random.map((text) => ({ text, version })))).toEqual(
        expectedFailures(version, random),
      );
    }, 60_000);

  for (const version of CORPUS_ROSE_VERSIONS)
    it(`draws every A-B-A-B-A word on the ${version} rose`, () => {
      // Regardie's rose moves only Kaph and Tau, so a word with neither is
      // the gd rose's figure; it is drawn once. The engine takes about
      // 12 ms a figure here, so this keeps the pair to about 6 s.
      const texts = ababaTexts(version).filter(
        (text) => version === "gd" || /[כת]/u.test(text),
      );
      expect(texts).toHaveLength(version === "gd" ? 22 * 21 : 82);
      expect(failing(texts.map((text) => ({ text, version })))).toEqual(
        expectedFailures(version, texts),
      );
    }, 60_000);

  it("draws every word of a collinear run, nooses in a row, on the gd rose", () => {
    const texts = collinearRunTexts();
    expect(texts).toHaveLength(3174);
    expect(failing(texts.map((text) => ({ text, version: "gd" })))).toEqual(
      expectedFailures("gd", texts),
    );
  }, 120_000);

  it("draws words side by side, right to left, in one SVG", () => {
    const rose = roseSigilLayout();
    const svg = draw("יהוה אלהים", rose);
    expect(svg).toContain('viewBox="-150 -50 200 100"');
    // In drawing order: each word's circle, strokes and marks, then its bar.
    expect(
      svg.match(/<path d="M [^"]*"><\/path>/g)?.map((p) => p.includes(" A ")),
    ).toEqual([true, false, true, false]);
    const plan = planSigil(sigilWords("יהוה אלהים"), rose, ROSE_SIGIL_PROFILE);
    expect(judge(svg, plan, rose)).toEqual([]);
  });
});

describe("the engine's drawings, broken, are caught", () => {
  const rose = roseSigilLayout();
  const plan = (text: string) =>
    planSigil(sigilWords(text), rose, ROSE_SIGIL_PROFILE);
  const caught = (svg: string, p: SigilPlan, layout = rose) => {
    const by: string[] = [];
    if (checkInvariants(svg, p, layout).length) by.push("O2");
    if (!checkReadBack(svg, p, layout).ok) by.push("O3");
    return by;
  };

  it("without its bar", () => {
    // The bar is the last path, drawn after the word's other ink.
    const svg = draw("מטטרון", rose).replace(
      /<path d="M [-\d.,]+ L [-\d.,]+"><\/path>/,
      "",
    );
    expect(svg).not.toBe(draw("מטטרון", rose));
    expect(caught(svg, plan("מטטרון"))).toEqual(["O2", "O3"]);
  });

  it("without its noose", () => {
    // Resh's noose is the second run of four arcs (the first is the start circle).
    const svg = draw("מטטרון", rose).replace(
      /( L [-\d.,]+)((?: A [-\d.,]+ 0 0,[01] [-\d.,]+){4})(?= L)/,
      "$1",
    );
    expect(svg).not.toBe(draw("מטטרון", rose));
    expect(caught(svg, plan("מטטרון"))).toEqual(["O2", "O3"]);
  });

  it("on a mirrored rose", () => {
    expect(
      caught(draw("מטטרון", rose), plan("מטטרון"), mirroredLayout(rose)),
    ).toEqual(["O2", "O3"]);
  });

  it("with its words joined", () => {
    expect(caught(draw("יודהאואוהא", rose), plan("יוד הא ואו הא"))).toEqual([
      "O2",
      "O3",
    ]);
  });

  it("with two letters swapped", () => {
    expect(caught(draw("מטטורן", rose), plan("מטטרון"))).toEqual(["O2", "O3"]);
  });
});

describe("the engine under a one-ulp nudge (O2)", () => {
  it("draws the 72 names and the fixtures identically", async () => {
    const unstable: string[] = [];
    for (const text of [
      ...SEVENTY_TWO_NAMES.map((n) => n.text),
      ...HAND_FIXTURES.map((f) => f.text),
    ])
      for (const version of CORPUS_ROSE_VERSIONS) {
        // Nudged before the layout rounds its anchors, where engines' trig
        // differs; a nudge of the rounded anchors is rounded away again.
        const source = {
          unrounded: roseUnroundedAnchor(version),
          quantise: svgCoordinate,
        };
        if (
          !(await checkStability(draw, text, roseSigilLayout(version), source))
            .stable
        )
          unstable.push(`${version} ${text}`);
      }
    expect(unstable).toEqual([]);
  });
});
