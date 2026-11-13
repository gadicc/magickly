import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import AstrologyText from "./astrology/AstrologyText";
import MoonText from "./astrology/moon/MoonText";
import PlanetaryHoursText from "./astrology/planetary-hours/PlanetaryHoursText";
import BooksText from "./books/BooksText";
import DictionaryText from "./enochian/dictionary/DictionaryText";
import EnochianText from "./enochian/EnochianText";
import KeysText from "./enochian/keys/KeysText";
import OrationText from "./enochian/oration/OrationText";
import TabletsText from "./enochian/tablets/TabletsText";
import GoldenDawnText from "./gd/GoldenDawnText";
import HallsText from "./gd/halls/HallsText";
import GeomancyText from "./geomancy/GeomancyText";
import ReadingText from "./geomancy/reading/ReadingText";
import ReferenceText from "./geomancy/reference/ReferenceText";
import HomeText from "./HomeText";
import KabbalahText from "./kabbalah/KabbalahText";
import TreeText from "./kabbalah/tree/TreeText";
import AngelsText from "./kabbalah/yhvh/72angels/AngelsText";
import DataText from "./open-source/data/DataText";
import { TABLE_NAMES, tablePath } from "./open-source/data/tables";
import OpenSourceText from "./open-source/OpenSourceText";

/** Each page's text below its tiles or tool (plan 071, decisions 4 and 5). */
const TEXTS: Record<string, ComponentType> = {
  "/": HomeText,
  "/kabbalah": KabbalahText,
  "/astrology": AstrologyText,
  "/enochian": EnochianText,
  "/gd": GoldenDawnText,
  "/geomancy": GeomancyText,
  "/books": BooksText,
  "/astrology/planetary-hours": PlanetaryHoursText,
  "/astrology/moon": MoonText,
  "/geomancy/reading": ReadingText,
  "/geomancy/reference": ReferenceText,
  "/enochian/dictionary": DictionaryText,
  "/enochian/keys": KeysText,
  "/enochian/tablets": TabletsText,
  "/enochian/oration": OrationText,
  "/kabbalah/tree": TreeText,
  "/kabbalah/yhvh/72angels": AngelsText,
  "/gd/halls": HallsText,
  "/open-source": OpenSourceText,
  "/open-source/data": DataText,
};

/**
 * The other sites a text may link: licences and where the packages live.
 * Their pages cannot be checked here, so each host is named on purpose.
 */
const OUTSIDE_HOSTS = new Set([
  "creativecommons.org",
  "github.com",
  "opensource.org",
  "www.gnu.org",
  "www.npmjs.com",
]);

const listed = new Set([
  ...sitemap().map(
    (entry) => new URL(entry.url).pathname.replace(/\/$/, "") || "/",
  ),
  // Pages that exist but stay out of the sitemap: the data tables', which
  // are not indexed for now (plan 080, decision 4).
  ...TABLE_NAMES.map(tablePath),
]);

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
      const url = new URL(href, "https://magick.ly");
      if (url.origin !== "https://magick.ly") {
        expect(url.protocol, href).toBe("https:");
        expect(OUTSIDE_HOSTS.has(url.host), href).toBe(true);
        continue;
      }
      const target = url.pathname;
      expect(listed.has(target), href).toBe(true);
      expect(target, href).not.toBe(path);
    }
  });
});
