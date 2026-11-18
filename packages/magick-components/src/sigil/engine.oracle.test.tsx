/**
 * The sigil engine against plan 088's oracle: planned by `planSigil`,
 * placed by `placeSigil` and drawn by `SigilImage`, every figure of the
 * corpus must pass O2 (invariants) and O3 (read-back), and the same
 * drawing must come out when every anchor moves by one ulp. O1 (the plans
 * alone) is `planSigil.test.ts`.
 *
 * The whole corpus runs here, in CI: the hand fixtures, the templates, the
 * 72 names and every pair and triple of letters on both roses (22,524
 * figures, about 7 s), and the kamea stubs. `KNOWN_FAILURES` lists the
 * figures the engine is known to draw wrongly; it is empty, and may only
 * shrink.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "../gd/roseSigilLayout.ts";
import { sigilFrame, sigilPathData, sigilViewBox } from "./ink.ts";
import {
  CORPUS_ROSE_VERSIONS,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "./oracle/corpus.ts";
import { HAND_FIXTURES, KAMEA_FIXTURES } from "./oracle/fixtures.ts";
import {
  checkInvariants,
  checkStability,
  type SigilDraw,
} from "./oracle/invariants.ts";
import { KAMEA_STUB_PROFILE, planetKameaLayout } from "./oracle/kameaLayout.ts";
import { mirroredLayout } from "./oracle/mutants.ts";
import { checkReadBack } from "./oracle/readBack.ts";
import { PLAN_TEMPLATES } from "./oracle/templates.ts";
import { placeSigil } from "./placeSigil.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import { SigilImage } from "./SigilImage.tsx";
import type { SigilLayout, SigilPlan, SigilProfile } from "./types.ts";

/** Figures the engine draws wrongly, by version and text, with the reason for each. */
const KNOWN_FAILURES: Readonly<Record<string, string>> = {};

/** `text` drawn by the engine on a rose layout, as the image route would. */
const draw = (text: string, layout: SigilLayout<string>): string =>
  renderToStaticMarkup(
    <SigilImage text={text} layout={layout} profile={ROSE_SIGIL_PROFILE} />,
  );

/** Tokens of any type drawn by the engine, as one SVG. */
function drawTokens<Token>(
  words: Token[][],
  layout: SigilLayout<Token>,
  profile: SigilProfile,
): { svg: string; plan: SigilPlan } {
  const plan = planSigil(words, layout, profile);
  const d = sigilPathData(placeSigil(plan, layout, profile), layout, profile);
  const viewBox = sigilViewBox(sigilFrame(layout), plan.length).join(" ");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path stroke="red" stroke-width="${layout.unit}" fill="none" d="${d}"/></svg>`,
    plan,
  };
}

/** What O2 and O3 say of `svg`, in one line each; empty when it passes. */
function judge(
  svg: string,
  plan: SigilPlan,
  layout: SigilLayout<string> | SigilLayout<number>,
): string[] {
  return [
    ...checkInvariants(svg, plan, layout).map(
      (f) => `O2 ${f.check}: ${f.message}`,
    ),
    ...checkReadBack(svg, plan, layout).failures.map((f) => `O3: ${f.message}`),
  ];
}

/** The texts of `cases` that fail O2 or O3, with their first failure. */
function failing(
  cases: Iterable<{ text: string; version: string }>,
): Record<string, string> {
  const failed: Record<string, string> = {};
  for (const { text, version } of cases) {
    const layout = roseSigilLayout(version);
    const plan = planSigil(sigilWords(text), layout, ROSE_SIGIL_PROFILE);
    const problems = judge(draw(text, layout), plan, layout);
    if (problems.length) failed[`${version} ${text}`] = problems[0];
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
      expect(judge(draw(fixture.text, rose), fixture.plan, rose)).toEqual([]);
    }
  });

  it("draws every template as its plan", () => {
    for (const template of PLAN_TEMPLATES) {
      const layout = roseSigilLayout(template.version);
      expect([
        template.id,
        judge(draw(template.text, layout), template.plan, layout),
      ]).toEqual([template.id, []]);
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

  it("draws the kamea stubs, so nothing in it is the rose's", () => {
    for (const fixture of KAMEA_FIXTURES) {
      const layout = planetKameaLayout(fixture.planet);
      const { svg, plan } = drawTokens(
        [[...fixture.numbers]],
        layout,
        KAMEA_STUB_PROFILE,
      );
      expect(plan).toEqual(fixture.plan);
      expect([fixture.id, judge(svg, plan, layout)]).toEqual([fixture.id, []]);
    }
  });

  it("draws words side by side, right to left, in one SVG", () => {
    const rose = roseSigilLayout();
    const svg = draw("יהוה אלהים", rose);
    expect(svg).toContain('viewBox="-150 -50 200 100"');
    expect(svg.match(/<path /g)).toHaveLength(1);
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
    const svg = draw("מטטרון", rose).replace(/ M [-\d.,]+ L [-\d.,]+"/, '"');
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
  const rose = roseSigilLayout();
  it("draws the 72 names and the fixtures identically", async () => {
    const unstable: string[] = [];
    for (const text of [
      ...SEVENTY_TWO_NAMES.map((n) => n.text),
      ...HAND_FIXTURES.map((f) => f.text),
    ])
      for (const layout of [rose, roseSigilLayout("regardie1939")])
        if (!(await checkStability(draw, text, layout)).stable)
          unstable.push(text);
    expect(unstable).toEqual([]);
  });

  it("draws the kamea stubs identically", async () => {
    for (const fixture of KAMEA_FIXTURES) {
      const drawNumbers: SigilDraw<number> = (text, layout) =>
        drawTokens([text.split(",").map(Number)], layout, KAMEA_STUB_PROFILE)
          .svg;
      expect(
        await checkStability(
          drawNumbers,
          fixture.numbers.join(","),
          planetKameaLayout(fixture.planet),
        ),
      ).toEqual({ stable: true, changed: [] });
    }
  });
});
