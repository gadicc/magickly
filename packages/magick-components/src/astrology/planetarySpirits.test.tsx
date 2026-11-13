import planets from "magick-data/astrology/planets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlanetarySpirit, {
  isPlanetarySpiritId,
  PLANETARY_SPIRIT_IDS,
} from "./planetarySpirits.tsx";

/** Half the sigils' stroke width (7), the ink beyond each line's centre. */
const HALF_STROKE = 3.5;

/**
 * Points along a path of absolute M, L, H, V, C and Z commands, the only
 * ones the sigils use: every vertex and fifteen points inside each curve.
 */
function pathPoints(d: string) {
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const n = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    switch (command) {
      case "M":
        [x, y] = n;
        [startX, startY] = n;
        break;
      case "L":
        [x, y] = n;
        break;
      case "H":
        [x] = n;
        break;
      case "V":
        [y] = n;
        break;
      case "C": {
        const [x1, y1, x2, y2, x3, y3] = n;
        for (let step = 1; step < 16; step++) {
          const t = step / 16;
          const u = 1 - t;
          points.push([
            u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
            u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
          ]);
        }
        [x, y] = [x3, y3];
        break;
      }
      case "Z":
        [x, y] = [startX, startY];
        break;
      default:
        throw new Error(`a command the sigils do not use: ${command}`);
    }
    points.push([x, y]);
  }
  return points;
}

/** A sigil's markup, its svg's viewBox and its paths' attributes. */
function sigil(id: string) {
  const html = renderToStaticMarkup(<PlanetarySpirit id={id} />);
  const viewBox = html
    .match(/viewBox="([^"]+)"/)?.[1]
    .split(" ")
    .map(Number);
  const paths = [...html.matchAll(/<path ([^>]*)>/g)].map(([, a]) => a);
  return { html, viewBox, paths };
}

describe("the planetary spirits' geomantic sigils", () => {
  it("draws the spirit of each planet that has one, and no other", () => {
    const spirits = Object.values(planets)
      .flatMap((planet) => ("spiritId" in planet ? [planet.spiritId] : []))
      .sort();
    expect(spirits).toHaveLength(7);
    expect([...PLANETARY_SPIRIT_IDS].sort()).toEqual(spirits);
  });

  it("draws each as one round-ended black stroke, with no fill or text", () => {
    for (const id of PLANETARY_SPIRIT_IDS) {
      const { html, paths } = sigil(id);
      expect(paths, id).toHaveLength(1);
      expect(paths[0], id).toContain('fill="none"');
      expect(paths[0], id).toContain('stroke="#000"');
      expect(paths[0], id).toContain('stroke-width="7"');
      expect(paths[0], id).toContain('stroke-linecap="round"');
      expect(html, id).not.toMatch(/<(text|image|use|circle|rect)\b/);
    }
  });

  it("fits each viewBox to its stroke, with a unit or so to spare", () => {
    for (const id of PLANETARY_SPIRIT_IDS) {
      const { viewBox, paths } = sigil(id);
      expect(viewBox, id).toHaveLength(4);
      const [left, top, width, height] = viewBox as number[];
      const d = paths[0].match(/(?:^| )d="([^"]+)"/)?.[1] ?? "";
      const points = pathPoints(d);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const margins = [
        Math.min(...xs) - HALF_STROKE - left,
        Math.min(...ys) - HALF_STROKE - top,
        left + width - (Math.max(...xs) + HALF_STROKE),
        top + height - (Math.max(...ys) + HALF_STROKE),
      ];
      for (const margin of margins) {
        expect(margin, `${id}: ${margins}`).toBeGreaterThanOrEqual(0.5);
        expect(margin, `${id}: ${margins}`).toBeLessThanOrEqual(2.5);
      }
    }
  });

  it("sizes the sigil by its box's height and passes the rest as style", () => {
    const html = renderToStaticMarkup(
      <PlanetarySpirit id="zazel" aria-hidden height="1.5em" color="red" />,
    );
    expect(html).toMatch(/^<div aria-hidden="true" style="[^"]*height:1.5em/);
    expect(html).toContain("color:red");
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('height="100%"');
    expect(html).not.toMatch(/<svg[^>]* width=/);
  });

  it("draws nothing for an id without a sigil", () => {
    expect(isPlanetarySpiritId("constructor")).toBe(false);
    expect(renderToStaticMarkup(<PlanetarySpirit id="constructor" />)).toBe("");
    expect(renderToStaticMarkup(<PlanetarySpirit />)).toBe("");
  });
});
