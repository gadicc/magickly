import { createHash } from "node:crypto";
import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlanetarySeal, {
  isPlanetarySealPlanet,
  PLANETARY_SEAL_LEAVES,
  PLANETARY_SEAL_SOURCE,
  PlanetarySealFigure,
  type PlanetarySealFigureProps,
} from "./PlanetarySeal.tsx";

const figure = (props: PlanetarySealFigureProps) =>
  renderToStaticMarkup(
    <svg aria-hidden="true">
      <PlanetarySealFigure {...props} />
    </svg>,
  );

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/**
 * Every end point a path's data moves or draws to, and every circle's
 * extent: not arcs' radii, nor quadratics' control points.
 */
function extents(markup: string): number[] {
  const values: number[] = [];
  for (const [, d] of markup.matchAll(/ d="([^"]+)"/g))
    for (const [, command, x, y] of d.matchAll(
      /([MLQA ])(-?[\d.]+),(-?[\d.]+)/g,
    ))
      if (command !== "A" && command !== "Q") values.push(+x, +y);
  for (const [, cx, cy, r] of markup.matchAll(
    /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g,
  ))
    values.push(+cx - +r, +cx + +r, +cy - +r, +cy + +r);
  return values;
}

describe("PlanetarySeal", () => {
  it("draws each of the seven planets' seals, each its own", () => {
    for (const look of ["page", "plate"] as const) {
      const seals = KAMEA_PLANETS.map((planet) => {
        const markup = figure({ planet, look });
        expect(markup, planet).toMatch(/<path d="M/);
        expect(markup, planet).not.toMatch(/<text|\sid=|href|url\(/);
        expect(markup.length, planet).toBeLessThan(6000);
        return markup;
      });
      expect(new Set(seals).size).toBe(KAMEA_PLANETS.length);
    }
    expect(Object.keys(PLANETARY_SEAL_LEAVES).sort()).toEqual(
      [...KAMEA_PLANETS].sort(),
    );
  });

  it("keeps every seal inside its box", () => {
    for (const planet of KAMEA_PLANETS) {
      // The page's box is 45 units each way, the plate's edge 47.
      for (const value of extents(figure({ planet })))
        expect(Math.abs(value), planet).toBeLessThan(43);
    }
  });

  it("draws the Moon's and Venus' seals on the plate as the hall drew them", () => {
    // The hall's seals of the Moon (Theoricus) and Venus (Philosophus)
    // before they moved here, byte for byte: the hall's pins hold them too.
    const moon = figure({ planet: "luna", look: "plate" });
    const venus = figure({ planet: "venus", look: "plate" });
    expect([moon.length, sha256(moon)]).toEqual([
      1587,
      "ade0860366ee58ac0c71146618d936f805ef61466eb75d0c343b02b0c29fc4c5",
    ]);
    expect([venus.length, sha256(venus)]).toEqual([
      899,
      "52045446d187122bee279d1fab87e837f5a2fc55e7a001560ddae6edc061ff08",
    ]);
    // The Moon's: a ring at the centre, four in the corners and two on
    // each of the four crescents' horns; twelve arcs of crescents.
    expect(moon.match(/<circle /g)).toHaveLength(13);
    expect(moon.match(/A[\d.]+,[\d.]+ 0 0 [01]/g)).toHaveLength(12);
    // Venus': the centre and three arms' ends ringed, and the ring below.
    expect(venus.match(/<circle /g)).toHaveLength(5);
  });

  it("stops the Moon's crescents at its rings on the page", () => {
    // On the plate the filled rings cover the crescents' horns; on the
    // page the rings are open, so the arcs end at their edges instead, on
    // the same circles.
    const radii = (markup: string) =>
      [...markup.matchAll(/A([\d.]+),/g)].map(([, r]) => r).sort();
    const page = figure({ planet: "luna" });
    const plate = figure({ planet: "luna", look: "plate" });
    expect(radii(page)).toEqual(radii(plate));
    expect(page).not.toContain("Z");
    expect(page).not.toMatch(/M-23,-38/);
  });

  it("draws on the page in the text's colour unless given another", () => {
    for (const planet of KAMEA_PLANETS) {
      const page = figure({ planet });
      // No colour of its own: currentColor follows the page, light or dark.
      expect(page, planet).not.toMatch(/#[0-9a-f]{3,6}/i);
      expect(page, planet).toMatch(/stroke="currentColor"/);
      expect(page, planet).not.toMatch(/fill="(?!none)/);
      expect(page, planet).not.toContain("<rect");
    }
    const inked = figure({ planet: "mars", ink: "var(--ink, #222)" });
    expect(inked).toContain('<g style="color:var(--ink, #222)">');
    expect(inked.replace(' style="color:var(--ink, #222)"', "")).toBe(
      figure({ planet: "mars" }),
    );
  });

  it("draws on the plate in the hall's silver and black unless given others", () => {
    const plate = figure({ planet: "sol", look: "plate" });
    expect(plate).toMatch(/^<svg aria-hidden="true"><rect [^>]*fill="#d3d7dc"/);
    expect(plate).not.toContain("currentColor");
    const custom = figure({
      planet: "sol",
      look: "plate",
      plate: "#eeeeee",
      ink: "#333333",
    });
    expect(custom).not.toMatch(/#d3d7dc|#000000/);
    expect(custom).toContain('fill="#eeeeee"');
    expect(custom).toContain('stroke="#333333"');
  });

  it("draws nothing without one of the seven", () => {
    expect(figure({})).toBe('<svg aria-hidden="true"></svg>');
    for (const planet of ["earth", "constructor", "moon"])
      expect(
        // @ts-expect-error: not a planet with a seal
        figure({ planet }),
        planet,
      ).toBe('<svg aria-hidden="true"></svg>');
    expect(isPlanetarySealPlanet("luna")).toBe(true);
    expect(isPlanetarySealPlanet("toString")).toBe(false);
  });

  it("is an <svg> of its own, square, sized and labelled as asked", () => {
    const plain = renderToStaticMarkup(<PlanetarySeal planet="saturn" />);
    expect(plain).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="-45 -45 90 90" width="120" height="120" role="img" aria-label="Seal of Saturn">/,
    );
    const plate = renderToStaticMarkup(
      <PlanetarySeal planet="sol" look="plate" height={80} className="s" />,
    );
    expect(plate).toContain('viewBox="-50 -50 100 100" width="80" height="80"');
    expect(plate).toContain('class="s" role="img" aria-label="Seal of Sol"');
    const hidden = renderToStaticMarkup(
      <PlanetarySeal planet="luna" label={false} />,
    );
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain("role=");
    expect(
      renderToStaticMarkup(<PlanetarySeal planet="venus" label="Venus" />),
    ).toContain('aria-label="Venus"');
  });

  it("cites the book, the copy and each leaf", () => {
    expect(PLANETARY_SEAL_SOURCE).toContain("DeOccultaPhilosophiaLoc1533");
    for (const { leaf, page } of Object.values(PLANETARY_SEAL_LEAVES)) {
      expect(PLANETARY_SEAL_SOURCE).toContain(`n${leaf}`);
      expect(PLANETARY_SEAL_SOURCE).toContain(`p. ${page}`);
    }
  });
});
