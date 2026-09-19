import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GradeTree from "../gd/GradeTree";
import TreeOfLife from "./TreeOfLife";

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
