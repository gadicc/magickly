import { readFileSync } from "node:fs";
import fields from "magick-data/fields";
import type { TableName } from "magick-data/tables";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { buildSearchCatalogue } from "@/search/catalogue";
import {
  columnsOf,
  entityHref,
  fieldAnchor,
  rowsOf,
  TABLE_NAMES,
  tablePath,
} from "../tables";
import { generateMetadata, generateStaticParams } from "./page";
import TablePage from "./TablePage";

// Emotion puts its styles inline before each element; they are not the page.
const render = (table: TableName) =>
  renderToString(<TablePage table={table} />).replace(
    /<style\b[^>]*>.*?<\/style>/g,
    "",
  );

const decode = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

const hrefs = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, href]) =>
    decode(href),
  );
const ids = (html: string) =>
  new Set([...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) => decode(id)));

const listed = new Set(sitemap().map((entry) => new URL(entry.url).pathname));

/** The ids the site's frame gives its own elements, read from its source. */
const LAYOUT_IDS = new Set(
  ["../../../layout.tsx", "../../../MyAppBar.tsx", "../../../SiteFooter.tsx"]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .flatMap((source) =>
      [...source.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id),
    ),
);

describe("/open-source/data/[table]", () => {
  it("has a page for every table and no other", () => {
    expect(generateStaticParams()).toEqual(
      Object.keys(fields.tables).map((table) => ({ table })),
    );
  });

  it("is followed but not indexed, with its own canonical (decision 4)", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ table: "sephirah" }),
    } as never);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/open-source/data/sephirah");
    expect(metadata.title).toBe("sephirah: a magick-data table");
    expect(metadata.description).toBe(fields.tables.sephirah.description);
    for (const table of TABLE_NAMES) {
      const { description } = await generateMetadata({
        params: Promise.resolve({ table }),
      } as never);
      expect(description, table).not.toContain("`");
    }
  });

  it("stays out of the sitemap and site search", async () => {
    const searched = new Set(
      (await buildSearchCatalogue()).documents.map((doc) => doc.path),
    );
    for (const table of TABLE_NAMES) {
      expect(listed.has(tablePath(table)), table).toBe(false);
      expect(searched.has(tablePath(table)), table).toBe(false);
    }
    expect(listed.has("/open-source/data")).toBe(true);
    expect(searched.has("/open-source/data")).toBe(true);
  });

  describe.each(TABLE_NAMES)("%s", (table) => {
    const html = render(table);
    const anchors = ids(html);

    it("names the table in its heading, with its import line", () => {
      expect(html).toMatch(new RegExp(`<h1[^>]*><code>${table}</code></h1>`));
      expect(decode(html)).toContain(
        `from "magick-data/${fields.tables[table].subpath.slice(2)}";`,
      );
    });

    it("makes every row an anchor, named by its key", () => {
      const keys = rowsOf(table).map(([key]) => key);
      expect(keys).toHaveLength(fields.tables[table].rows);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(anchors.has(key), key).toBe(true);
    });

    it("gives nothing else on the page, or around it, a row's name", () => {
      const all = [...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) =>
        decode(id),
      );
      expect(all.length, "ids are unique").toBe(new Set(all).size);
      for (const [key] of rowsOf(table)) {
        expect(key, key).not.toMatch(/^(field|detail)-/);
        expect(LAYOUT_IDS.has(key), key).toBe(false);
      }
    });

    it("links each column's header and each field to its entry", () => {
      for (const field of fields.tables[table].fields)
        expect(anchors.has(fieldAnchor(field.path)), field.path).toBe(true);
      for (const href of hrefs(html).filter((h) => h.startsWith("#")))
        expect(anchors.has(href.slice(1)), href).toBe(true);
    });

    it("links each id to a row that exists, on its table's page", () => {
      for (const href of hrefs(html).filter((h) =>
        h.startsWith("/open-source/data/"),
      )) {
        const [path, key] = href.split("#");
        const target = path.split("/").at(-1) as TableName;
        expect(TABLE_NAMES, href).toContain(target);
        if (key !== undefined)
          expect(
            rowsOf(target).some(([k]) => k === key),
            href,
          ).toBe(true);
      }
    });

    it("links rows to their pages where the site has them, and those exist", () => {
      for (const [key, row] of rowsOf(table)) {
        const href = entityHref(table, key, row);
        if (href) expect(listed.has(href), href).toBe(true);
      }
    });
  });

  it("gives entity pages to the planets, grades, sephirot, paths and genii", () => {
    const withPages = TABLE_NAMES.filter((table) =>
      rowsOf(table).every(([key, row]) => entityHref(table, key, row)),
    );
    expect(withPages).toEqual([
      "planet",
      "gdGrade",
      "sephirah",
      "treeOfLifePath",
      "seventyTwoAngel",
    ]);
  });
});

describe("a table's field list", () => {
  it("says what an id that is not a link names, with the right article", () => {
    const planet = render("planet").replace(/<!-- -->/g, "");
    expect(planet).toContain(
      "an id of an intelligence, which has no table yet",
    );
    expect(planet).toContain("an id of a spirit, which has no table yet");
    const paths = render("treeOfLifePath").replace(/<!-- -->/g, "");
    expect(paths).toContain(
      "an id from <code>tarot-deck</code>, outside the package",
    );
  });

  it("sets Hebrew that stands alone in a Hebrew face", () => {
    expect(render("hebrewLetter")).toMatch(
      /The letter itself: <span[^>]*lang="he"[^>]*dir="rtl"[^>]*>א<\/span>/,
    );
  });

  it("links a row of the same table on the page, and another table's by its page", () => {
    const grades = render("gdGrade");
    expect(hrefs(grades)).toContain("#1=10");
    expect(hrefs(grades)).toContain("/open-source/data/sephirah#malchut");
    expect(hrefs(grades)).not.toContain("/open-source/data/gdGrade#1=10");
  });
});

describe("a table's columns (decision 4)", () => {
  const paths = (table: TableName) =>
    columnsOf(table).map(({ field }) => field.path);

  it("are an object's keys, one each", () => {
    expect(paths("archangel")).toEqual([
      "id",
      "name.he",
      "name.roman",
      "name.en",
      "planetId",
      "sephirahId",
    ]);
  });

  it("are only the keys a field names, where it names them", () => {
    const color = paths("sephirah").filter((path) => path.startsWith("color"));
    expect(color).toEqual(["color.queen", "color.king"]);
  });

  it("leave maps and arrays of objects to the detail", () => {
    expect(paths("enochianTablet")).toEqual(["id", "kind"]);
    expect(paths("tetragram")).not.toContain("meanings");
    expect(paths("tetragram")).toContain("planetIds");
  });

  it("draw a colour's swatch from its CSS value", () => {
    // The swatches' colours are in Emotion's styles, which render() strips.
    const html = renderToString(<TablePage table="sephirah" />);
    expect(html).toContain("background-color:#c0448f");
    // Malchut's four quarters.
    for (const color of ["#80461B", "#ba0", "#880", "#000000"])
      expect(html).toContain(`background-color:${color}`);
  });

  it("name a table with no id field by its key", () => {
    const html = render("godName");
    expect(html).toMatch(/<th[^>]*>key<\/th>/);
    expect(ids(html).has("ehiyeh")).toBe(true);
  });
});
