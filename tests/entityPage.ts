import { expect } from "vitest";
import Data from "@/../data/data";
import { angelSlugs } from "@/../data/kabbalah/angelSlugs";
import { divisions } from "@/../data/kabbalah/lenain/volume";
import { publicRitualQueryKeys } from "@/doc/publicRituals";
import { PUBLIC_PAGES } from "@/seo/pages";

/**
 * What every entity page's markup must hold (plan 036, "Tests").
 *
 * The four table pages used to print their rows as JSON, and what that and
 * the pages' other defects rendered is what this looks for, by the strings
 * they rendered rather than by a pattern that would also match "(II)". Every
 * link must land on a page this site has, so a relative id, an id that is
 * not a row, or a route nobody built fails here rather than as a 404.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** The markup's character references, decoded. */
function decode(html: string) {
  return html.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,
    (entity, body: string) => {
      if (body[0] !== "#") return NAMED[body.toLowerCase()] ?? entity;
      return String.fromCodePoint(
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10),
      );
    },
  );
}

/**
 * The text a reader sees in `renderToString` markup: style and script
 * elements dropped with their content, tags removed without a trace, as
 * `textContent` does, character references decoded and every run of
 * whitespace one space. MUI's emotion writes its styles inline on the
 * server, which is why they go first.
 */
export function textOf(html: string) {
  return decode(
    html
      .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]*>/g, ""),
  ).replace(/\s+/g, " ");
}

/** What today's defects render, as they appear in the markup. */
const DEFECTS = [
  "{&quot;",
  "[object Object]",
  "undefined",
  "NaN",
  "(&quot;&quot;)",
  "(no sephirah)",
  ": None",
];

/** Every route a page on this site may link to. */
const ROUTES = new Set<string>([
  ...Object.keys(PUBLIC_PAGES),
  ...Object.keys(Data.planet).map((id) => `/astrology/planet/${id}`),
  ...Object.keys(Data.gdGrade).map((id) => `/gd/grade/${id}`),
  ...Object.keys(Data.sephirah).map((id) => `/kabbalah/sephirah/${id}`),
  ...Object.keys(Data.tolPath).map((id) => `/kabbalah/path/${id}`),
  ...angelSlugs().map((slug) => `/kabbalah/angel/${slug}`),
  ...Object.keys(publicRitualQueryKeys).map((id) => `/doc/${id}`),
  // What the book's route generates its params from.
  ...divisions.map(
    (division) => `/books/la-science-cabalistique/${division.slug}`,
  ),
]);

/** Every `href` and `xlink:href` value in the markup, decoded. */
function linksOf(html: string) {
  return [...html.matchAll(/\s(?:xlink:)?href="([^"]*)"/g)].map(([, value]) =>
    decode(value),
  );
}

/**
 * Every `href` and `xlink:href` in the markup that leaves the page, decoded,
 * without its query or fragment. A same-page reference, `#topTextPath0`, is
 * not a route: the Tree lays each sphere's labels along a curve it names so.
 */
export function hrefsOf(html: string) {
  return linksOf(html)
    .filter((value) => !value.startsWith("#"))
    .map((value) => value.split(/[?#]/, 1)[0]);
}

/** The same-page references, `#id`, that name no element on the page. */
function danglingReferences(html: string) {
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) => decode(id)),
  );
  return linksOf(html)
    .filter((value) => value.startsWith("#"))
    .filter((value) => !ids.has(value.slice(1)));
}

/**
 * Asserts what every entity page body must hold, given its `renderToString`
 * markup and the text its heading must contain: one `<h1>`, containing it;
 * none of the strings a defect renders; no link that leaves the site's
 * routes; and no same-page reference to an element the page lacks. Each
 * failure names what it found.
 */
export function expectEntityPage(html: string, heading: string) {
  const headings = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  expect(html.match(/<h1\b/g) ?? [], "the page's <h1>s").toHaveLength(1);
  expect(textOf(headings[0] ?? ""), "the <h1>").toContain(heading);

  expect(
    DEFECTS.filter((defect) => html.includes(defect)),
    "defects in the markup",
  ).toEqual([]);

  expect(
    hrefsOf(html).filter((href) => !ROUTES.has(href)),
    "links to no route of this site",
  ).toEqual([]);
  expect(
    danglingReferences(html),
    "references to no element on the page",
  ).toEqual([]);
}
