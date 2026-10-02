import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GradeTree from "../gd/GradeTree";
import TreeOfLife, { labelLines } from "./TreeOfLife";

const count = (html: string, pattern: RegExp) =>
  html.match(pattern)?.length ?? 0;

/** One or two doubles away from zero: the size of a Node/Chromium difference. */
const nudge = (value: number) => value * (1 + Number.EPSILON);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TreeOfLife", () => {
  it("hydrates when the browser's trig results differ in the last bit", () => {
    // The path outlines and Malkuth's wedges come out of sin, cos and atan,
    // which engines round differently in the last bit. React reports any
    // such attribute difference as a hydration mismatch.
    const render = () => renderToString(<TreeOfLife field="name.he" />);
    const server = render();
    const { atan, cos, sin } = Math;
    vi.spyOn(Math, "atan").mockImplementation((x) => nudge(atan(x)));
    vi.spyOn(Math, "cos").mockImplementation((x) => nudge(cos(x)));
    vi.spyOn(Math, "sin").mockImplementation((x) => nudge(sin(x)));

    expect(render()).toBe(server);
    // The path data, where the trig lands, keeps at most three decimals. The
    // other coordinates are sums and Math.sqrt, which every engine rounds
    // the same way, so they are left alone.
    const numbers = [...server.matchAll(/ d="([^"]*)"/g)].flatMap(
      ([, value]) => value.match(/-?[\d.]+(?:e[-+]?\d+)?/g) ?? [],
    );
    expect(numbers.length).toBeGreaterThan(200);
    for (const number of numbers) expect(number).toMatch(/^-?\d+(\.\d{1,3})?$/);
  });

  it("breaks a list per item, and anything else at its first space", () => {
    expect(labelLines("pearl; star sapphire")).toEqual([
      "pearl",
      "star sapphire",
    ]);
    expect(labelLines("star ruby; turquoise")).toEqual([
      "star ruby",
      "turquoise",
    ]);
    expect(labelLines("YHVH Eloah VeDa'at")).toEqual(["YHVH", "Eloah VeDa'at"]);
    expect(labelLines("a; b; c")).toEqual(["a", "b", "c"]);
    expect(labelLines("a; ; b")).toEqual(["a", "b"]);
    expect(labelLines("Keter")).toEqual(["Keter"]);
    expect(labelLines("  ")).toEqual([]);
  });

  it("sets a label's lines a little more than a font size apart", () => {
    // They were a fixed 22 apart, more than twice the usual font size.
    const html = renderToString(<TreeOfLife field="stones.*.name.en" />);
    const y = (word: string) =>
      Number(
        html.match(
          new RegExp(`<text[^>]* y="([\\d.-]+)"[^>]*>${word}</text>`),
        )?.[1],
      );
    expect(y("star sapphire") - y("pearl")).toBeCloseTo(12, 3);
    expect(y("turquoise") - y("star ruby")).toBeCloseTo(12, 3);
    // Centred on the sphere: Binah's two lines sit either side of the
    // centre a one-line label would take.
    const single = renderToString(<TreeOfLife field="name.roman" />);
    const centre = Number(
      single.match(/<text[^>]* y="([\d.-]+)"[^>]*>Binah<\/text>/)?.[1],
    );
    expect((y("pearl") + y("star sapphire")) / 2).toBeCloseTo(centre, 3);
  });

  it("spaces lines by a CSS font size, and by 10 where there is none", () => {
    // The Tree page passes its query's text through, and "12px" is a valid
    // SVG font size; multiplying it as it stood drew the lines at NaN.
    for (const [fontSize, gap] of [
      ["12px", 14.4],
      ["20", 24],
      ["large", 12],
    ] as const) {
      const html = renderToString(
        <TreeOfLife field="stones.*.name.en" fontSize={fontSize} />,
      );
      expect(html, fontSize).not.toContain("NaN");
      const y = (word: string) =>
        Number(
          html.match(
            new RegExp(`<text[^>]* y="([\\d.-]+)"[^>]*>${word}</text>`),
          )?.[1],
        );
      expect(y("star sapphire") - y("pearl"), fontSize).toBeCloseTo(gap, 3);
    }
  });

  it("writes only real rules into its stylesheet", () => {
    // It appended `flip && "…"`, so an unflipped Tree's stylesheet ended in
    // the word "undefined", or "false" where a caller passed it; the entity
    // pages' check refuses the first, and both are junk CSS (plan 036).
    const style = (html: string) =>
      html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
    for (const flip of [undefined, false])
      expect(style(renderToString(<TreeOfLife flip={flip} />))).not.toMatch(
        /undefined|false|rotateY/,
      );
    expect(style(renderToString(<TreeOfLife flip />))).toContain(
      "transform: rotateY(180deg)",
    );
  });

  it("links every path and sephirah by default", () => {
    const html = renderToString(<TreeOfLife />);
    // 22 path outlines, 22 path letters and 10 sephirot.
    expect(count(html, /<a /g)).toBe(54);
    expect(count(html, /<a [^>]*xlink:href="\/kabbalah\//g)).toBe(54);
    // Every id is its own: a path, its letter, and each sephirah.
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws paths without a destination as plain groups", () => {
    // GradeTree links only the sephirot, to their grades.
    const html = renderToString(<GradeTree />);
    expect(count(html, /<a /g)).toBe(10);
    expect(count(html, /<a [^>]*xlink:href="\/gd\/grade\//g)).toBe(10);
    // 22 path outlines and their 22 letters, each with its own id.
    expect(count(html, /<g id="path\d+_\d+">/g)).toBe(22);
    expect(count(html, /<g id="pathLetter\d+_\d+">/g)).toBe(22);
  });
});
