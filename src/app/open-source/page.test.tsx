import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import OpenSourcePage, { metadata } from "./page";

// Emotion puts its styles inline before each element; they are not the page.
const html = renderToString(<OpenSourcePage />).replace(
  /<style\b[^>]*>.*?<\/style>/g,
  "",
);

/** A package's card, from its anchor to the next card or the end. */
function card(name: string) {
  const start = html.indexOf(`id="${name}"`);
  expect(start, name).toBeGreaterThan(-1);
  const next = html.indexOf('id="magick-', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

const hrefs = (part: string) =>
  [...part.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, href]) => href);

describe("/open-source", () => {
  it("is indexed, with its own title and snippet", () => {
    expect(metadata.alternates?.canonical).toBe("/open-source");
    expect(metadata.description).toMatch(/MIT/);
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/open-source");
  });

  it("states each licence the policy names", () => {
    for (const licence of [
      "GNU Affero General Public License",
      "MIT",
      "CC BY 4.0",
      "SIL Open Font License 1.1",
    ])
      expect(html).toContain(licence);
    expect(hrefs(html)).toContain("/about#credits");
  });

  it("offers the published package to install, with links to npm and GitHub", () => {
    const data = card("magick-data");
    expect(data).toContain("npm i magick-data");
    expect(data).toContain("import data from &quot;magick-data&quot;");
    expect(hrefs(data)).toEqual(
      expect.arrayContaining([
        "https://www.npmjs.com/package/magick-data",
        "https://github.com/gadicc/magickly/tree/main/packages/magick-data",
      ]),
    );
  });

  it("offers no install of a package that is not on npm", () => {
    const components = card("magick-components");
    expect(components).toContain("not on npm yet");
    expect(components).not.toContain("npm i");
    expect(hrefs(components)).not.toContain(
      "https://www.npmjs.com/package/magick-components",
    );
    expect(hrefs(components)).toContain(
      "https://github.com/gadicc/magickly/tree/main/src/components",
    );
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
});
