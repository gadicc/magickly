import lune from "lune";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Moon } from "./Moon.tsx";
import { MOON_MEAN_INCLINATION, moonPath } from "./moonPath.ts";

const lit = (html: string) =>
  html.match(/<path class="moon" d="([^"]+)"/)?.[1] ?? null;
/** The turn, on the group inside the root, which SVG 1.1 renderers honour. */
const turn = (html: string) =>
  html.match(/^<svg [^>]*><defs>.*?<\/defs><g transform="([^"]+)">/)?.[1];

describe("Moon", () => {
  it("draws a phase it is given, on the server", () => {
    const html = renderToStaticMarkup(<Moon phase={0.3} height={85} />);
    expect(html).toMatch(/^<svg [^>]*height="85"/);
    expect(lit(html)).toBe(moonPath(0.3));
    expect(turn(html)).toBe(`rotate(${MOON_MEAN_INCLINATION} 85 81)`);
    expect(html).toMatch(/^<svg (?![^>]*transform)[^>]*>/);
  });

  it("works out a date's phase, and lets a phase win", () => {
    const date = new Date("2026-11-14T12:00:00Z");
    expect(lit(renderToStaticMarkup(<Moon date={date} />))).toBe(
      moonPath(lune.phase(date).phase),
    );
    expect(lit(renderToStaticMarkup(<Moon date={date} phase={0.5} />))).toBe(
      moonPath(0.5),
    );
  });

  it("draws the unlit disc alone with neither", () => {
    const html = renderToStaticMarkup(<Moon />);
    expect(lit(html)).toBeNull();
    expect(html.match(/<path class="back"/g)).toHaveLength(2);
  });

  it("turns as seen from the south", () => {
    expect(
      turn(renderToStaticMarkup(<Moon phase={0.2} hemisphere="south" />)),
    ).toBe(`rotate(${180 - MOON_MEAN_INCLINATION} 85 81)`);
  });

  // lune.phase() never returns for an invalid date, so a regression would
  // hang; the timeout makes it fail instead.
  it("refuses an invalid date rather than hang", { timeout: 2000 }, () => {
    expect(() => renderToStaticMarkup(<Moon date={new Date(NaN)} />)).toThrow(
      RangeError,
    );
    expect(() =>
      renderToStaticMarkup(<Moon date={new Date("not a date")} />),
    ).toThrow(/Moon: date/);
    // A phase given wins, so the date is not read.
    expect(
      lit(renderToStaticMarkup(<Moon date={new Date(NaN)} phase={0.5} />)),
    ).toBe(moonPath(0.5));
  });

  it("refuses a phase outside 0 to 1", () => {
    for (const phase of [-0.1, 1.0000001, Number.NaN, Infinity])
      expect(
        () => renderToStaticMarkup(<Moon phase={phase} />),
        String(phase),
      ).toThrow(RangeError);
  });
});
