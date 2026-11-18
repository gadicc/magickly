import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoseSigil from "./RoseSigil.tsx";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import { letterPoint, sigilPoints } from "./roseSigilGeometry.ts";

/** One or two doubles away from zero: the size of a Node/Chromium trig difference. */
const nudge = (value: number) => value * (1 + Number.EPSILON);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoseSigil", () => {
  it("hydrates when the browser's trig results differ in the last bit", () => {
    // The server and the browser both draw the figure placed by rule from
    // anchors rounded to 0.001; `engine.oracle.test.tsx` nudges the anchors
    // themselves by an ulp.
    const render = () =>
      renderToString(<RoseSigil text="אבג" showRose animate />);
    const server = render();
    const yod = letterPoint("י");
    const { cos, sin } = Math;
    vi.spyOn(Math, "cos").mockImplementation((x) => nudge(cos(x)));
    vi.spyOn(Math, "sin").mockImplementation((x) => nudge(sin(x)));
    expect(letterPoint("י")).not.toEqual(yod);
    expect(render()).toBe(server);

    // Node 25 wrote י's label at y="30.310889132455348", Chromium 152 at …344.
    expect(server).toContain('<text x="-17.5" y="30.311"');
    const numbers = [...server.matchAll(/ (?:x|y|cx|cy|d)="([^"]*)"/g)].flatMap(
      ([, value]) => value.match(/-?[\d.]+(?:e[-+]?\d+)?/g) ?? [],
    );
    expect(numbers.length).toBeGreaterThan(80);
    for (const number of numbers) expect(number).toMatch(/^-?\d+(\.\d{1,3})?$/);
  });

  it("draws repeated letters as crooks on the server, with nothing to wait for", () => {
    // Two crooks at the first letter and two at the last: eight cups, on
    // the one stroke from Daleth to Beth.
    const html = renderToString(
      <RoseSigil text="דדדבבב" showRose={false} animate />,
    );
    const paths = [...html.matchAll(/<path [^>]*\bd="([^"]*)"/g)];
    expect(paths).toHaveLength(1);
    const [[, d]] = paths;
    expect(d).toMatch(/^M [-\d.]+,[-\d.]+ A 1.5,1.5 /);
    expect(d.match(/C /g)).toHaveLength(8);
    expect(d).not.toContain("NaN");
  });

  it("draws each word as its own sigil", () => {
    const html = renderToStaticMarkup(
      <RoseSigilImage text="יהוה אלהים" showRose />,
    );
    expect(html).toContain('viewBox="-150 -50 200 100"');
    // The rose behind each word, the second moved into its region.
    expect(html.match(/<circle /g)).toHaveLength(8);
    expect(html).toContain('transform="translate(-100 0)"');
    expect(html.match(/<path /g)).toHaveLength(1);
  });

  it("draws any text: final forms as their base letters, the rest left out", () => {
    // A final form or a Latin letter once threw while rendering.
    const draw = (text: string) =>
      renderToStaticMarkup(
        <RoseSigilImage
          text={text}
          showRose={false}
          debug
          points={sigilPoints(text)}
        />,
      );
    expect(draw("שלום")).toBe(draw("שלומ"));
    expect(draw("שָׁלוֹם, world")).toBe(draw("שלומ"));
    expect(draw("Latin")).toBe(draw(""));
    expect(draw("")).toContain("<path");
  });

  it("draws the letters' circles and the first path when debugging", () => {
    const draw = (debug: boolean) =>
      renderToStaticMarkup(
        <RoseSigilImage
          text="אבג"
          showRose
          debug={debug}
          points={sigilPoints("אבג")}
        />,
      );
    const circles = (html: string) => html.match(/<circle /g)?.length ?? 0;
    // Four rings, and with debug a circle round each of the 22 letters.
    expect(circles(draw(false))).toBe(4);
    expect(circles(draw(true))).toBe(26);
    expect(draw(true)).toContain('stroke="#aa0"');
    expect(draw(false)).not.toContain('stroke="#aa0"');
  });

  it("draws the rose and no debugging unless told otherwise, as RoseSigil does", () => {
    const points = sigilPoints("אבג");
    expect(
      renderToStaticMarkup(<RoseSigilImage text="אבג" points={points} />),
    ).toBe(
      renderToStaticMarkup(
        <RoseSigilImage text="אבג" showRose debug={false} points={points} />,
      ),
    );
  });
});
