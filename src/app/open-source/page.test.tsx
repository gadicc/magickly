import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import OpenSource from "@/OpenSource";
import { SITE_REPOSITORY } from "@/seo/site";
import { DATA_USAGE } from "./OpenSourceText";
import OpenSourcePage, { metadata } from "./page";

const root = fileURLToPath(new URL("../../../", import.meta.url));

// Emotion puts its styles inline before each element; they are not the page.
const strip = (markup: string) =>
  markup.replace(/<style\b[^>]*>.*?<\/style>/g, "");
const html = strip(renderToString(<OpenSourcePage />));

/** Text as the reader sees it: tags dropped, entities decoded. */
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

/** A package's card: its whole `<article>`. */
function card(name: string) {
  const found = html.match(
    new RegExp(`<article\\b[^>]*\\sid="${name}"[^>]*>.*?</article>`, "s"),
  )?.[0];
  expect(found, name).toBeTruthy();
  return found as string;
}

/** The licence list's item that starts with this bold lead. */
function licence(lead: string) {
  const item = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)]
    .map(([, inner]) => inner)
    .find((inner) => inner.startsWith(`<b>${lead}</b>`));
  expect(item, lead).toBeTruthy();
  return text(item as string);
}

const hrefs = (part: string) =>
  [...part.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, href]) =>
    href.replace(/&amp;/g, "&"),
  );

describe("/open-source", () => {
  it("is indexed, with its own title and snippet", () => {
    expect(metadata.alternates?.canonical).toBe("/open-source");
    expect(metadata.description).toMatch(/MIT/);
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/open-source");
  });

  it("says what each licence covers", () => {
    expect(licence("The app")).toMatch(
      /GNU Affero General Public License, version 3 or any later version/,
    );
    expect(licence("The code of the data and the components")).toMatch(
      /is MIT .*That includes the drawings the components make/,
    );
    expect(licence("The data")).toMatch(
      /is CC BY 4\.0 .*except where its README says no rights are asserted/,
    );
    expect(licence("The images the site draws or makes itself")).toMatch(
      /are CC BY 4\.0 too, with credit to Magick\.ly.*The code that draws them is MIT/,
    );
    expect(licence("The fonts")).toMatch(/SIL Open Font License 1\.1/);
    expect(licence("Work by others")).toMatch(/keeps its own licence/);
    expect(licence("The Enochian dictionary")).toMatch(/under none of these/);
    expect(hrefs(html)).toContain("/about#credits");
  });

  it("credits served drawings to Magick.ly until the components are on npm", () => {
    // Plan 080: stage G switches the hub, the hall pages and the halls'
    // embedded credit together.
    expect(html).not.toContain("drawn by magick-components");
  });

  it("offers the published package to install, with links to npm and GitHub", () => {
    const data = card("magick-data");
    expect(data).toContain("npm i magick-data");
    expect(text(data)).toContain(DATA_USAGE);
    expect(hrefs(data)).toEqual(
      expect.arrayContaining([
        "https://www.npmjs.com/package/magick-data",
        `${SITE_REPOSITORY}/tree/main/packages/magick-data`,
      ]),
    );
    expect(data).toContain('aria-label="magick-data&#x27;s source on GitHub"');
  });

  it("shows the data package's usage exactly as its README does", () => {
    const readme = readFileSync(
      `${root}packages/magick-data/README.md`,
      "utf8",
    );
    const installing = readme.slice(readme.indexOf("## Installing"));
    const sample = installing.match(/```js\n(.*?)\n```/s)?.[1];
    expect(sample).toBe(DATA_USAGE);
  });

  it("offers no install of a package that is not on npm", () => {
    const components = card("magick-components");
    expect(components).toContain("not on npm yet");
    expect(components).not.toContain("npm i");
    expect(hrefs(components)).not.toContain(
      "https://www.npmjs.com/package/magick-components",
    );
    expect(components).toContain(
      'aria-label="magick-components&#x27;s source on GitHub"',
    );
  });

  it("links files and directories of this repository that exist", () => {
    // Also catches a card whose package has moved (stage E).
    const own = hrefs(html).filter((href) =>
      href.startsWith(`${SITE_REPOSITORY}/`),
    );
    expect(own.length).toBeGreaterThan(0);
    for (const href of own) {
      const path = href
        .slice(SITE_REPOSITORY.length)
        .replace(/#.*$/, "")
        .match(/^\/(?:blob|tree)\/main\/(.+)$/)?.[1];
      expect(path, href).toBeTruthy();
      expect(existsSync(`${root}${path}`), href).toBe(true);
    }
  });

  it("links no section page that does not exist yet", () => {
    const listed = new Set(
      sitemap().map((entry) => new URL(entry.url).pathname),
    );
    for (const href of hrefs(html).filter((href) => href.startsWith("/")))
      expect(
        listed.has(new URL(href, "https://magick.ly").pathname),
        href,
      ).toBe(true);
  });

  it("has every anchor other pages link to", () => {
    const ids = new Set(
      [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id),
    );
    for (const file of [
      "src/app/about/page.tsx",
      "src/app/gd/halls/[slug]/HallPage.tsx",
    ]) {
      const anchors = [
        ...readFileSync(`${root}${file}`, "utf8").matchAll(
          /href="\/open-source#([^"]+)"/g,
        ),
      ].map(([, id]) => id);
      expect(anchors.length, file).toBeGreaterThan(0);
      for (const id of anchors)
        expect(ids.has(id), `${file}: #${id}`).toBe(true);
    }
  });
});

describe("the open-source line under pages", () => {
  it("links the hub as well as the file", () => {
    const line = renderToString(<OpenSource href="@/app/page.tsx" />);
    expect(hrefs(line)).toEqual([
      "/open-source",
      `${SITE_REPOSITORY}/blob/main/src/app/page.tsx`,
    ]);
  });
});
