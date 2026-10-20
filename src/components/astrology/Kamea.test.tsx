import kameas, {
  KAMEA_PLANETS,
  type KameaPlanetId,
} from "magick-data/astrology/kameas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Kamea, { KAMEA_SIDE, KameaFigure, kameaGeometry } from "./Kamea";

/** The numbers drawn, in document order. */
const numbers = (markup: string) =>
  [...markup.matchAll(/<text [^>]*>(\d+)<\/text>/g)].map(([, n]) => Number(n));

/** Each number's position, by number. */
const positions = (markup: string) =>
  new Map(
    [
      ...markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)">(\d+)<\/text>/g),
    ].map(([, x, y, n]) => [Number(n), [Number(x), Number(y)]]),
  );

describe("Kamea", () => {
  it("draws each planet's square, row by row, every number once", () => {
    for (const planet of KAMEA_PLANETS) {
      const markup = renderToStaticMarkup(<Kamea planet={planet} />);
      const square = kameas[planet];
      expect(numbers(markup), planet).toEqual(square.flat());
      const n = square.length;
      expect(
        [...numbers(markup)].sort((a, b) => a - b),
        planet,
      ).toEqual(Array.from({ length: n * n }, (_, i) => i + 1));
    }
  });

  it("puts each number in its cell", () => {
    const markup = renderToStaticMarkup(<Kamea planet="saturn" />);
    // 4 9 2 / 3 5 7 / 8 1 6, cells 32 units across from −48.
    const at = positions(markup);
    expect(at.get(4)).toEqual([-32, -26.47]);
    expect(at.get(5)).toEqual([0, 5.53]);
    expect(at.get(6)).toEqual([32, 37.53]);
    // Two rules each way between the three rows and columns.
    expect(markup).toContain('d="M-16,-48V48M-48,-16H48M16,-48V48M-48,16H48"');
  });

  it("is an <svg> of its own, square, sized and labelled as asked", () => {
    const labelled = renderToStaticMarkup(
      <Kamea planet="luna" size={180} label="Kamea of Luna" className="k" />,
    );
    expect(labelled).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="-50 -50 100 100" width="180" height="180" class="k" role="img" aria-label="Kamea of Luna">/,
    );
    expect(labelled).not.toContain("aria-hidden");
    const plain = renderToStaticMarkup(<Kamea planet="luna" />);
    expect(plain).toContain('width="240" height="240"');
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain("role=");
  });

  it("writes no ids, links or stylesheet, so many can share a page", () => {
    const page = renderToStaticMarkup(
      <>
        {KAMEA_PLANETS.map((planet) => (
          <Kamea key={planet} planet={planet} label={planet} />
        ))}
      </>,
    );
    expect(page).not.toMatch(/\sid=|href|url\(|<style|<defs/);
  });

  it("takes the font and colours it is given", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <KameaFigure
          planet="mars"
          fontFamily="Example Serif"
          paper="#fffbe6"
          ink="#222"
        />
      </svg>,
    );
    expect(markup).toContain('fill="#fffbe6" stroke="#222"');
    expect(markup).toContain('font-family="Example Serif"');
    expect(markup).toContain('<g fill="#222"');
    const defaults = renderToStaticMarkup(
      <svg>
        <KameaFigure planet="mars" />
      </svg>,
    );
    expect(defaults).toContain('fill="#ffffff" stroke="#000000"');
    expect(defaults).toContain('font-family="serif"');
  });

  it("draws an empty frame without a planet", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <KameaFigure />
      </svg>,
    );
    expect(markup).toBe(
      '<svg><rect x="-48" y="-48" width="96" height="96" fill="#ffffff" stroke="#000000" stroke-width="2"></rect></svg>',
    );
  });

  it("draws an empty frame for a name that is not a planet", () => {
    const empty = renderToStaticMarkup(
      <svg>
        <KameaFigure />
      </svg>,
    );
    for (const name of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
      "sun",
    ]) {
      const planet = name as KameaPlanetId;
      expect(
        renderToStaticMarkup(
          <svg>
            <KameaFigure planet={planet} />
          </svg>,
        ),
        name,
      ).toBe(empty);
      expect(() =>
        renderToStaticMarkup(<Kamea planet={planet} />),
      ).not.toThrow();
    }
  });

  it("draws what it is given over the numbers, in the square's frame", () => {
    const { centre } = kameaGeometry(3);
    const [x1, y1] = centre(0, 0);
    const [x2, y2] = centre(2, 2);
    const overlay = <path d={`M${x1},${y1}L${x2},${y2}`} stroke="red" />;
    const markup = renderToStaticMarkup(
      <svg>
        <KameaFigure planet="saturn">{overlay}</KameaFigure>
      </svg>,
    );
    // Last, so it lies over the numbers; from 4's cell to 6's.
    expect(markup).toMatch(
      /<\/g><path d="M-32,-32L32,32" stroke="red"><\/path><\/svg>$/,
    );
    expect(
      renderToStaticMarkup(
        <svg>
          <KameaFigure>{overlay}</KameaFigure>
        </svg>,
      ),
    ).toContain('<path d="M-32,-32L32,32" stroke="red">');
  });
});

describe("kameaGeometry", () => {
  it("divides the square into its order's cells, centred on 0,0", () => {
    for (let order = 3; order <= 9; order++) {
      const { cell, centre } = kameaGeometry(order);
      expect(cell * order).toBeCloseTo(KAMEA_SIDE, 10);
      const [left, top] = centre(0, 0);
      const [right, bottom] = centre(order - 1, order - 1);
      expect(left).toBeCloseTo(-KAMEA_SIDE / 2 + cell / 2, 10);
      expect(top).toBeCloseTo(left, 10);
      expect(right).toBeCloseTo(-left, 10);
      expect(bottom).toBeCloseTo(-top, 10);
    }
    // Rows go down and columns across.
    expect(kameaGeometry(4).centre(0, 3)).toEqual([36, -36]);
  });
});
