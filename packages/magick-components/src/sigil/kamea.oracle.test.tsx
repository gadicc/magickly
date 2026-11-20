/**
 * The sigil engine on the kameas against plan 088's oracle, unchanged
 * (plan 093, K2): planned by `planSigil`, placed by `placeSigil` and drawn
 * by `SigilImage` on `kameaLayout` with `KAMEA_SIGIL_PROFILE`, every figure
 * must plan as the reference does (O1), pass O2 (invariants) and O3
 * (read-back), and draw the same when every anchor moves by one ulp.
 *
 * The corpus: vol. 4's two worked examples and the grid's templates, by
 * hand; every name the pages trace, in every witness's spelling and both
 * finals modes, which may not fail at all, not even placement's own
 * checks (but the one in `KAMEA_NAME_KNOWN_FAILURES`, a spelling with
 * finals only the generator traces); every letter-reachable triple on all
 * seven squares; and seeded
 * random words of 4 to 12 letters on each. `KAMEA_KNOWN_FAILURES`
 * (`oracle/engineKnownFailures.ts`) lists the figures the engine is known
 * to draw wrongly and may only shrink.
 */

import type { KameaPlanetId } from "magick-data/astrology/kameas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { svgCoordinate } from "../svgCoordinate.ts";
import { KAMEA_SIGIL_PROFILE, kameaLayout } from "./kameaLayout.ts";
import { kameaUnroundedAnchor } from "./oracle/anchors.ts";
import {
  KAMEA_KNOWN_FAILURES,
  KAMEA_NAME_KNOWN_FAILURES,
} from "./oracle/engineKnownFailures.ts";
import { KAMEA_FIXTURES } from "./oracle/fixtures.ts";
import { checkInvariants, checkStability } from "./oracle/invariants.ts";
import {
  CORPUS_KAMEA_PLANETS,
  KAMEA_RANDOM_CORPUS,
  kameaNameCases,
  kameaTriples,
  randomKameaTexts,
} from "./oracle/kameaCorpus.ts";
import { KAMEA_TEMPLATES } from "./oracle/kameaTemplates.ts";
import { checkReadBack } from "./oracle/readBack.ts";
import { referencePlan, referenceWords } from "./oracle/referencePlan.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import { SigilImage, sigilFigure } from "./SigilImage.tsx";
import type { SigilLayout, SigilPlan } from "./types.ts";

/** `text` drawn by the engine on a kamea layout, as a page would. */
const draw = (text: string, layout: SigilLayout<string>): string =>
  renderToStaticMarkup(
    <SigilImage text={text} layout={layout} profile={KAMEA_SIGIL_PROFILE} />,
  );

/** The checks `svg` fails, as `KAMEA_KNOWN_FAILURES` names them; empty when it passes. */
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

/**
 * The texts on `planet`'s square that misplan (O1, against the reference)
 * or fail O2 or O3, keyed as `KAMEA_KNOWN_FAILURES` keys them.
 */
function failing(
  planet: KameaPlanetId,
  texts: Iterable<string>,
): Record<string, string> {
  const layout = kameaLayout(planet);
  const failed: Record<string, string> = {};
  for (const text of texts) {
    const expected = referencePlan(
      referenceWords(text),
      layout,
      KAMEA_SIGIL_PROFILE,
    );
    const plan = planSigil(sigilWords(text), layout, KAMEA_SIGIL_PROFILE);
    if (JSON.stringify(plan) !== JSON.stringify(expected))
      failed[`${planet} ${text}`] = "O1";
    else {
      const checks = checksFailed(draw(text, layout), expected, layout);
      if (checks) failed[`${planet} ${text}`] = checks;
    }
  }
  return failed;
}

const expectedFailures = (planet: KameaPlanetId, texts: Iterable<string>) => {
  const wanted = new Set([...texts].map((text) => `${planet} ${text}`));
  return Object.fromEntries(
    Object.entries(KAMEA_KNOWN_FAILURES).filter(([key]) => wanted.has(key)),
  );
};

describe("the engine on the kameas, against O1–O3", () => {
  it("draws vol. 4's two examples as their plans", () => {
    for (const fixture of KAMEA_FIXTURES) {
      const layout = kameaLayout(fixture.planet);
      expect(
        planSigil(sigilWords(fixture.text), layout, KAMEA_SIGIL_PROFILE),
      ).toEqual(fixture.plan);
      const figure = sigilFigure(fixture.text, layout, KAMEA_SIGIL_PROFILE);
      expect([
        fixture.id,
        checksFailed(draw(fixture.text, layout), fixture.plan, layout),
        figure.failures,
      ]).toEqual([fixture.id, "", [[]]]);
    }
  });

  it("draws every grid template as its plan", () => {
    for (const template of KAMEA_TEMPLATES) {
      const layout = kameaLayout(template.planet);
      expect([
        template.id,
        checksFailed(draw(template.text, layout), template.plan, layout),
      ]).toEqual([
        template.id,
        KAMEA_KNOWN_FAILURES[`${template.planet} ${template.text}`] ?? "",
      ]);
    }
  });

  it("draws every name the pages trace, in every spelling, with nothing failing", () => {
    const cases = kameaNameCases();
    // Each reading's Hebrew and the spirit of spirits' division, at
    // ordinary values and with finals, less the cases that trace the same
    // cells: 51 at ordinary values and 9 where finals move a cell, from
    // 37 of the table's 38 names. Shelachel, with no witness, has none.
    expect(cases).toHaveLength(60);
    expect(cases.filter((c) => c.finals)).toHaveLength(9);
    expect(new Set(cases.map((c) => c.nameId)).size).toBe(37);
    expect(cases.filter((c) => c.nameId === "shelachel")).toEqual([]);
    const failed: Record<string, string> = {};
    for (const c of cases) {
      const layout = kameaLayout(c.planet, { finals: c.finals });
      const expected = referencePlan(
        referenceWords(c.text),
        layout,
        KAMEA_SIGIL_PROFILE,
      );
      const figure = sigilFigure(c.text, layout, KAMEA_SIGIL_PROFILE);
      const placed = figure.failures.some((f) => f.length > 0);
      const problems =
        JSON.stringify(figure.plan) === JSON.stringify(expected)
          ? checksFailed(draw(c.text, layout), expected, layout)
          : "O1";
      // Placement flags whatever O2 or O3 would refuse, and more.
      if (problems || placed) failed[c.id] = problems || "placement";
    }
    expect(failed).toEqual(KAMEA_NAME_KNOWN_FAILURES);
  }, 60_000);

  for (const planet of CORPUS_KAMEA_PLANETS)
    it(`draws every letter-reachable triple on ${planet}'s square`, () => {
      const texts = kameaTriples(planet);
      expect(failing(planet, texts)).toEqual(expectedFailures(planet, texts));
    }, 60_000);

  for (const planet of CORPUS_KAMEA_PLANETS)
    it(`plans and draws random words of ${KAMEA_RANDOM_CORPUS.minLength} to ${KAMEA_RANDOM_CORPUS.maxLength} letters on ${planet}'s square`, () => {
      const texts = randomKameaTexts(planet);
      expect(failing(planet, texts)).toEqual(expectedFailures(planet, texts));
    }, 60_000);

  it("draws a name's words side by side, right to left, each in its square", () => {
    const layout = kameaLayout("luna");
    const text = "שדברשהמעת שרתתן";
    const svg = draw(text, layout);
    expect(svg).toContain('viewBox="-150 -50 200 100"');
    const plan = planSigil(sigilWords(text), layout, KAMEA_SIGIL_PROFILE);
    expect(plan).toHaveLength(2);
    expect(checksFailed(svg, plan, layout)).toBe("");
  });

  it("draws with the profile's stroke, fixed against the square", () => {
    const svg = draw("זאזל", kameaLayout("saturn"));
    expect(svg).toContain(`stroke-width="${KAMEA_SIGIL_PROFILE.strokeWidth}"`);
    expect(
      renderToStaticMarkup(
        <SigilImage
          text="זאזל"
          layout={kameaLayout("saturn")}
          profile={KAMEA_SIGIL_PROFILE}
          strokeWidth={2}
        />,
      ),
    ).toContain('stroke-width="2"');
  });
});

describe("the engine on the kameas under a one-ulp nudge (O2)", () => {
  it("draws vol. 4's examples and every name identically", async () => {
    const unstable: string[] = [];
    const cases = [
      ...KAMEA_FIXTURES.map((f) => ({
        id: f.id,
        planet: f.planet,
        text: f.text,
        finals: false,
      })),
      ...kameaNameCases(),
    ];
    for (const c of cases) {
      const layout = kameaLayout(c.planet, { finals: c.finals });
      const result = await checkStability(draw, c.text, layout, {
        unrounded: kameaUnroundedAnchor(Math.sqrt(layout.places.length)),
        quantise: svgCoordinate,
      });
      if (!result.stable) unstable.push(c.id);
    }
    expect(unstable).toEqual([]);
  }, 60_000);
});
