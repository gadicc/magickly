// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import PlanetarySpirit, {
  PLANETARY_SPIRIT_IDS,
} from "magick-components/astrology/planetarySpirits";
import Chakras from "magick-components/chakras/Chakras";
import Lamen from "magick-components/gd/Lamen";
import RoseSigil from "magick-components/gd/RoseSigil";
import SevenBranchedCandleStick from "magick-components/gd/SevenBranchedCandleStick";
import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import TreeOfLife from "magick-components/kabbalah/TreeOfLife";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import GeomancyReading from "@/app/geomancy/reading/reading";
import { readingFromSearchParams } from "@/app/geomancy/reading/readingState";
import Ink, { type InkDrawing, inkClass } from "./Ink";

/**
 * Each dark re-ink rule (plan 076, decision 4) selects inside a drawing by
 * what the drawing already has: ids, colour attributes, unfilled shapes. A
 * change to the drawing's colours would leave the rule matching nothing and
 * the line art black on the dark page, with nothing failing. This reads the
 * rules from ink.module.css and checks that each one's selector, with the
 * real wrapper class, still matches something in the drawing it targets.
 */

/** The drawing each class re-inks, rendered inside its wrapper class. */
const drawings: Record<InkDrawing, () => string[]> = {
  // The reading page has the tetragram, chart and pentagram wrappers itself.
  tetragram: reading,
  geomancyChart: reading,
  pentagram: reading,
  // Every planetary spirit's sigil.
  spirit: () =>
    PLANETARY_SPIRIT_IDS.map((id) =>
      wrapped("spirit", <PlanetarySpirit id={id} />),
    ),
  candlestick: () => [wrapped("candlestick", <SevenBranchedCandleStick />)],
  shewbread: () => [wrapped("shewbread", <TableOfShewbread />)],
  roseSigil: () => [
    wrapped(
      "roseSigil",
      <RoseSigil sigilText="אבג" showRose animate={false} debug={false} />,
    ),
  ],
  chakras: () => [wrapped("chakras", <Chakras />)],
  lamen: () => [wrapped("lamen", <Lamen officer="hierophant" />)],
  // With Da'at, whose dashed outline has its own rule.
  tree: () => [wrapped("tree", <TreeOfLife field="name.he" showDaat />)],
};

function wrapped(drawing: InkDrawing, element: ReactElement) {
  return renderToStaticMarkup(<Ink drawing={drawing}>{element}</Ink>);
}

function reading() {
  return [
    renderToStaticMarkup(
      <GeomancyReading
        initial={readingFromSearchParams(new URLSearchParams({ house: "1" }))}
      />,
    ),
  ];
}

/** A selector list's selectors: commas inside `()`, `[]` or quotes stay. */
function splitSelectors(list: string) {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts;
}

/** Each `.dark .<drawing> …` selector in the module, with its drawing. */
function inkRules() {
  const css = readFileSync(path.resolve("src/drawings/ink.module.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/:global\(([^)]*)\)/g, "$1");
  return [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, selectors]) =>
    splitSelectors(selectors)
      .map((selector) => selector.replace(/\s+/g, " ").trim())
      .filter((selector) => selector.startsWith(".dark "))
      .map((selector) => {
        const match = selector.match(/^\.dark \.(\w+)( .*)$/);
        if (!match) throw new Error(`unexpected ink selector: ${selector}`);
        const [, drawing, rest] = match;
        return { selector, drawing: drawing as InkDrawing, rest };
      }),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

const rules = inkRules();

describe("dark ink rules", () => {
  it("reads every drawing's rules", () => {
    expect(rules.length).toBeGreaterThan(15);
    expect(new Set(rules.map((rule) => rule.drawing))).toEqual(
      new Set(Object.keys(drawings)),
    );
  });

  it.each(rules)("$selector matches its drawing", ({ drawing, rest }) => {
    const render = drawings[drawing];
    expect(render, `no drawing for .${drawing}`).toBeTypeOf("function");
    // The wrapper's real (hashed) class, then the drawing-side selector.
    const selector = `.${inkClass(drawing)}${rest}`;
    const markups = render();
    expect(markups.length).toBeGreaterThan(0);
    for (const markup of markups) {
      document.body.innerHTML = markup;
      expect(
        document.querySelectorAll(selector).length,
        `${selector} in ${markup.slice(0, 80)}`,
      ).toBeGreaterThan(0);
    }
  });
});
