import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoseSigil from "./RoseSigil.tsx";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import { sigilPoints } from "./roseSigilGeometry.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoseSigil", () => {
  it("writes every number to three places, so engines that differ in trig agree", () => {
    // That a last-bit difference in trig cannot change the figure is the
    // oracle's to show: anchors.ts holds every unrounded anchor at least
    // 1e-6 from a rounding boundary, and engine.oracle.test.tsx nudges the
    // unrounded anchors by an ulp before the layout rounds them.
    const server = renderToString(
      <RoseSigil text="אבגדהוזחטיכלמנסעפצקרשת יהוה" showRose animate />,
    );
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
    // The word's ink, then its bar.
    const paths = [...html.matchAll(/<path [^>]*\bd="([^"]*)"/g)];
    expect(paths).toHaveLength(2);
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
    // Each word's ink and its bar, in the order they are drawn on.
    expect(html.match(/<path /g)).toHaveLength(4);
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
