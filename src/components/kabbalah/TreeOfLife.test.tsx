import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GradeTree from "../gd/GradeTree";
import TreeOfLife from "./TreeOfLife";

const count = (html: string, pattern: RegExp) =>
  html.match(pattern)?.length ?? 0;

describe("TreeOfLife", () => {
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
