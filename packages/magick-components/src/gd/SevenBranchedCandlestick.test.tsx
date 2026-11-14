import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SevenBranchedCandlestick, {
  CANDLESTICK_PLANETS,
  CANDLESTICK_VERSION_NOTES,
  CANDLESTICK_VERSIONS,
  DEFAULT_CANDLESTICK_VERSION,
} from "./SevenBranchedCandlestick.tsx";

const draw = (props: Parameters<typeof SevenBranchedCandlestick>[0] = {}) =>
  renderToStaticMarkup(<SevenBranchedCandlestick {...props} />);

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** The direction of a point from the centre, clockwise from the top. */
const bearing = (x: number, y: number) =>
  (((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360) / (360 / 7);

describe("the candlestick's versions", () => {
  it("are the 1909 figure by default, and the modern arrangement", () => {
    expect(CANDLESTICK_VERSIONS).toEqual(["equinox1909", "modern"]);
    expect(DEFAULT_CANDLESTICK_VERSION).toBe("equinox1909");
    expect(draw()).toBe(draw({ version: "equinox1909" }));
    // Anything else is the default, as for the tablets' versions.
    expect(draw({ version: "1909" as never })).toBe(draw());
    expect(draw({ version: "modern" })).not.toBe(draw());
    expect(Object.keys(CANDLESTICK_VERSION_NOTES)).toEqual([
      ...CANDLESTICK_VERSIONS,
    ]);
    expect(CANDLESTICK_VERSION_NOTES.equinox1909.title).toBe("Equinox 1909");
    expect(CANDLESTICK_VERSION_NOTES.modern.title).toBe("Modern");
    expect(CANDLESTICK_VERSION_NOTES.equinox1909.sources[0].url).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%202/page/n266",
    );
  });

  it("draws the modern arrangement exactly as before the versions", () => {
    // The markup of the component before 14 November 2026, with no
    // version, under each prefix: the hall's, a page's and its own.
    expect(sha256(draw({ version: "modern" }))).toBe(
      "1a02752ba7cca347960d79426a34577ee794ad5d81408bcb107e1853fc1fd16e",
    );
    expect(sha256(draw({ version: "modern", idPrefix: "x" }))).toBe(
      "4d6d9b95b305c58fd7ede8b1bf3c1e30a5045a79a6dbea8f3992af2c02d02c4a",
    );
    expect(
      sha256(draw({ version: "modern", idPrefix: "_R_0_-art11-candlestick" })),
    ).toBe("704b21354a85c2cc910a75e29fa5e15f847bb8572bab179f248712324f0e5a4e");
  });
});

describe("the candlestick of 1909", () => {
  const svg = draw();
  // Each lamp is a group turned to its place; the lamps come last.
  const lamps = svg
    .split('<g transform="rotate(')
    .slice(1)
    .map((chunk) => {
      const end = chunk.indexOf(")");
      return [chunk, chunk.slice(0, end), chunk.slice(end)] as const;
    });

  it("sets the planets about the circle as Diagram 17 does", () => {
    expect(CANDLESTICK_PLANETS.equinox1909).toEqual([
      "saturn",
      "mars",
      "venus",
      "luna",
      "jupiter",
      "sol",
      "mercury",
    ]);
    expect(lamps).toHaveLength(7);
    const texts = lamps.map(([, , inner]) =>
      [...inner.matchAll(/>([^<>]+)<\/(?:text|textPath)>/g)].map(
        ([, text]) => text,
      ),
    );
    // Letter, the planet's name, its Sephirah's archangel, the church:
    // magick-data's names, without points, and the figure's churches.
    expect(texts).toEqual([
      ["ת", "שבתאי", "צפקיאל", "Ephesus"],
      ["פ", "מאדים", "חמאל", "Pergamos"],
      ["ד", "נגה", "הניאל", "Thyatira"],
      ["ג", "לבנה", "גבריאל", "Laodicea"],
      ["כ", "צדק", "צדקיאל", "Philadelphia"],
      ["ר", "שמש", "רפאל", "Smyrna"],
      ["ב", "כוכב", "מיכאל", "Sardis"],
    ]);
  });

  it("points each triangle outward, its lamp turned to its place", () => {
    lamps.forEach(([, rotate, inner], index) => {
      const [angle, cx, cy] = rotate.split(" ").map(Number);
      expect(angle).toBeCloseTo((index * 360) / 7, 2);
      const triangle = inner.match(/<path d="M ([^"]*) Z"/)?.[1];
      const [apex, ...base] = (triangle ?? "")
        .split(" L ")
        .map((pair) => pair.split(" ").map(Number));
      // Before the turn, the apex is above the lamp's centre, the base
      // below it: away from the centre once turned.
      expect(apex[1]).toBeLessThan(cy);
      for (const corner of base) expect(corner[1]).toBeGreaterThan(cy);
      expect(apex[0]).toBeCloseTo(cx, 3);
      // The lamp is where its planet stands.
      expect(bearing(cx, cy)).toBeCloseTo(index, 3);
    });
  });

  it("traces the Chaldean order with its star, and the week every second lamp", () => {
    const star = svg.match(
      /<path d="M ([^"]*) Z" fill="none" stroke="black"/,
    )?.[1];
    const points = (star ?? "")
      .split(" L ")
      .map((pair) => pair.split(" ").map(Number));
    const order = points.map(
      ([x, y]) =>
        CANDLESTICK_PLANETS.equinox1909[Math.round(bearing(x, y)) % 7],
    );
    expect(order).toEqual([
      "saturn",
      "jupiter",
      "mars",
      "sol",
      "venus",
      "mercury",
      "luna",
    ]);
    const lampsOf = CANDLESTICK_PLANETS.equinox1909;
    const sun = lampsOf.indexOf("sol");
    expect(
      Array.from({ length: 7 }, (_, day) => lampsOf[(sun - 2 * day + 14) % 7]),
    ).toEqual(["sol", "luna", "mars", "mercury", "jupiter", "venus", "saturn"]);
  });

  it("draws the central lamp and each planet's symbol on its arm", () => {
    expect(svg).toContain('<circle cx="0" cy="0" r="3.4"');
    const symbols = [
      ...svg.matchAll(
        /<text x="([^"]*)" y="([^"]*)"[^>]*font-size="3.5">([^<]*)<\/text>/g,
      ),
    ];
    expect(symbols.map(([, , , symbol]) => symbol)).toEqual([
      "♄",
      "♂",
      "♀",
      "☾",
      "♃",
      "☉",
      "☿",
    ]);
    symbols.forEach(([, x, y], index) =>
      expect(bearing(Number(x), Number(y))).toBeCloseTo(index, 3),
    );
  });

  it("keeps every coordinate to three decimals", () => {
    const numbers = [
      ...svg.matchAll(/ (?:x|y|cx|cy|d|transform)="([^"]*)"/g),
    ].flatMap(([, value]) => value.match(/-?[\d.]+(?:e[-+]?\d+)?/g) ?? []);
    expect(numbers.length).toBeGreaterThan(100);
    for (const number of numbers) expect(number).toMatch(/^-?\d+(\.\d{1,3})?$/);
  });
});
