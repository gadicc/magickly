import lune from "lune";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Moon } from "./Moon.tsx";
import { MOON_MEAN_INCLINATION, moonPath } from "./moonPath.ts";

const lit = (html: string) =>
  html.match(/<path class="moon" d="([^"]+)"/)?.[1] ?? null;

describe("Moon", () => {
  it("draws a phase it is given, on the server", () => {
    const html = renderToStaticMarkup(<Moon phase={0.3} height={85} />);
    expect(html).toMatch(/^<svg [^>]*height="85"/);
    expect(lit(html)).toBe(moonPath(0.3));
    expect(html).toContain(`transform="rotate(${MOON_MEAN_INCLINATION})"`);
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
      renderToStaticMarkup(<Moon phase={0.2} hemisphere="south" />),
    ).toContain(`transform="rotate(${180 - MOON_MEAN_INCLINATION})"`);
  });

  it("gives each moon on a page its own glow", () => {
    const html = renderToStaticMarkup(
      <>
        <Moon phase={0.1} />
        <Moon phase={0.9} />
      </>,
    );
    const ids = [...html.matchAll(/<filter id="([^"]+)"/g)].map(([, id]) => id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
