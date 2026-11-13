import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { EXPLORER_COMPONENTS } from "@/explorer/components";
import ComponentsPage, { metadata } from "./page";

// Emotion puts its styles inline before each element; they are not the page.
const html = renderToString(<ComponentsPage />).replace(
  /<style\b[^>]*>.*?<\/style>/g,
  "",
);

/** A component's tile: its whole `<li>`. */
function tile(path: string) {
  const found = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)]
    .map(([, inner]) => inner)
    .find((inner) => inner.includes(`href="${path}"`));
  expect(found, path).toBeTruthy();
  return found as string;
}

describe("/open-source/components", () => {
  it("is indexed, in the sitemap, with its own description", () => {
    expect(metadata).toMatchObject({
      alternates: { canonical: "/open-source/components" },
    });
    expect(sitemap().map((entry) => entry.url)).toContain(
      "https://magick.ly/open-source/components",
    );
  });

  it("has a tile for every component, linking to its page", () => {
    for (const component of EXPLORER_COMPONENTS) {
      const found = tile(component.path);
      expect(found.replace(/<[^>]+>/g, "")).toContain(component.name);
      expect(found).toContain(component.title.replace(/'/g, "&#x27;"));
    }
  });

  it("shows the image route's drawing where there is one", () => {
    expect(tile("/open-source/components/tree-of-life")).toContain(
      'src="/api/render/tree-of-life?field=name.roman&amp;bottomText=name.en&amp;fontSize=10"',
    );
    expect(tile("/open-source/components/rose-sigil")).toContain(
      'src="/api/render/rose-sigil?text=',
    );
    expect(tile("/open-source/components/gd-hall")).toContain(
      'src="/gd/halls/neophyte/golden-dawn-neophyte-temple-small.png"',
    );
  });

  it("draws the rest live on the server, Mercury as its picture", () => {
    expect(tile("/open-source/components/kamea")).toContain("<svg");
    expect(tile("/open-source/components/fylfot-cross")).toContain("<table");
    expect(tile("/open-source/components/mercury")).toContain(
      'src="/pics/mercury.webp"',
    );
  });

  it("nests no link in a tile's link", () => {
    for (const component of EXPLORER_COMPONENTS)
      expect(tile(component.path).match(/<a\b/g), component.name).toHaveLength(
        1,
      );
  });

  it("says the package is not on npm, and offers no install", () => {
    expect(html).toContain("They are not on npm yet.");
    expect(html).not.toMatch(/npm i\b/);
  });
});
