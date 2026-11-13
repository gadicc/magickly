import Data from "magick-data";
import fields from "magick-data/fields";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import OpenSourcePage from "../page";
import DataPage, { metadata } from "./page";
import { relationsOf, TABLE_NAMES, tablePath } from "./tables";

// Emotion puts its styles inline before each element; they are not the page,
// and nor are the markers React puts between adjacent pieces of text.
const strip = (html: string) =>
  html.replace(/<style\b[^>]*>.*?<\/style>/g, "").replace(/<!-- -->/g, "");
const html = strip(renderToString(<DataPage />));
const hrefs = (part: string) =>
  [...part.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, href]) => href);

const listed = new Set(sitemap().map((entry) => new URL(entry.url).pathname));

describe("/open-source/data", () => {
  it("is indexed, with its own title and snippet", () => {
    expect(metadata.alternates?.canonical).toBe("/open-source/data");
    expect(String(metadata.description)).toMatch(/magick-data/);
    expect(listed.has("/open-source/data")).toBe(true);
  });

  it("lists every table, linking its page, with its row count and subpath", () => {
    const links = hrefs(html);
    for (const name of TABLE_NAMES) {
      const table = fields.tables[name];
      expect(links, name).toContain(tablePath(name));
      expect(html).toContain(`magick-data/${table.subpath.slice(2)}`);
      expect(html).toContain(`, ${table.rows} rows, `);
    }
  });

  it("says which tables a table links to, and which link to it", () => {
    /** A table's entry: the list item whose first link is its page. */
    const entry = (name: string) =>
      html.split("<li").find((item) => hrefs(item)[0] === tablePath(name)) ??
      "";
    const degree = entry("gdDegree");
    expect(degree).toContain("Linked from");
    expect(hrefs(degree)).toEqual([
      tablePath("gdDegree"),
      tablePath("gdGrade"),
    ]);
    const grade = entry("gdGrade");
    expect(grade).toContain(", and to its own rows.");
    expect(hrefs(grade)).toContain(tablePath("gdDegree"));
    expect(entry("seventyTwoAngel")).not.toContain("Links to");
  });

  it("lists every text, with the page that shows it", () => {
    for (const [subpath, text] of Object.entries(fields.texts)) {
      expect(html).toContain(`magick-data/${subpath.slice(2)}`);
      if (text.page) {
        expect(listed.has(text.page), text.page).toBe(true);
        expect(hrefs(html)).toContain(text.page);
      }
    }
  });

  it("is right that the tables the barrel leaves out link to none and from none", () => {
    // Not the converse: geomanticHouse links nothing and is in the barrel.
    const left = TABLE_NAMES.filter((name) => !Object.hasOwn(Data, name));
    expect(left.length).toBeGreaterThan(0);
    for (const name of left)
      expect(relationsOf(name), name).toEqual({
        to: [],
        from: [],
        self: false,
      });
  });

  it("gives each text its import line, and its page only where it has one", () => {
    expect(html).toContain(
      "import * as keys from &quot;magick-data/enochian/keys&quot;;",
    );
    expect(html).toContain(
      "import evidence from &quot;magick-data/json/kabbalah/lenain/evidence.json&quot; with { type: &quot;json&quot; };",
    );
    expect(html).toContain("Most are shown on a page of the site.");
  });

  it("says the data's licence with its exception", () => {
    expect(html).toContain("The data is under CC BY 4.0, except where");
    expect(hrefs(html)).toContain(
      "https://github.com/gadicc/magickly/tree/main/packages/magick-data#sources",
    );
  });

  it("says the barrel leaves out the tables that link to nothing", () => {
    expect(html).toContain("holds 26 of the 29 tables");
    for (const name of ["enochianTablet", "christianChoir", "seventyTwoAngel"])
      expect(html).toContain(`<code>${name}</code>`);
  });

  it("is linked from the data package's card on the hub", () => {
    const hub = strip(renderToString(<OpenSourcePage />));
    const card = hub.slice(
      hub.indexOf('id="magick-data"'),
      hub.indexOf('id="magick-components"'),
    );
    expect(hrefs(card)).toContain("/open-source/data");
  });
});
