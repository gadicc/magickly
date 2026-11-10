import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import AstrologyText from "./astrology/AstrologyText";
import BooksText from "./books/BooksText";
import EnochianText from "./enochian/EnochianText";
import GoldenDawnText from "./gd/GoldenDawnText";
import GeomancyText from "./geomancy/GeomancyText";
import HomeText from "./HomeText";
import KabbalahText from "./kabbalah/KabbalahText";

/** Each section page's text below its tiles (plan 071, decision 4). */
const TEXTS: Record<string, ComponentType> = {
  "/": HomeText,
  "/kabbalah": KabbalahText,
  "/astrology": AstrologyText,
  "/enochian": EnochianText,
  "/gd": GoldenDawnText,
  "/geomancy": GeomancyText,
  "/books": BooksText,
};

const listed = new Set(
  sitemap().map(
    (entry) => new URL(entry.url).pathname.replace(/\/$/, "") || "/",
  ),
);

describe.each(Object.entries(TEXTS))("%s's text", (path, Text) => {
  // Emotion puts its styles inline before each element; they are not the page.
  const html = renderToString(<Text />).replace(
    /<style\b[^>]*>.*?<\/style>/g,
    "",
  );

  it("is a section named by its first heading, which is an h2", () => {
    const first = html.match(/<h(\d)\b([^>]*)>/);
    expect(first?.[1]).toBe("2");
    const id = first?.[2].match(/\sid="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(new RegExp(`^<section[^>]*aria-labelledby="${id}"`));
  });

  it("skips no heading level under the bar's h1", () => {
    const levels = [...html.matchAll(/<h(\d)\b/g)].map(([, n]) => Number(n));
    expect(levels).not.toContain(1);
    levels.forEach((level, i) => {
      expect(level - (levels[i - 1] ?? 2)).toBeLessThanOrEqual(1);
    });
  });

  it("links only pages that exist, and never itself", () => {
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(
      ([, href]) => href.replace(/&amp;/g, "&"),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const target = new URL(href, "https://magick.ly").pathname;
      expect(listed.has(target), href).toBe(true);
      expect(target, href).not.toBe(path);
    }
  });
});
