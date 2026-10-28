import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";
import HallIndex from "./HallIndex";
import HallsPage from "./page";

/** The text a reader sees: MUI's inline styles and the tags dropped. */
const text = (html: string) =>
  html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "");

describe("the temple halls' index", () => {
  const html = renderToString(<HallIndex />);

  it("links every hall's page with its lazy thumbnail, by grade", () => {
    const links = [...html.matchAll(/<a[^>]*href="(\/gd\/halls\/[^"]+)"/g)].map(
      ([, href]) => href,
    );
    expect(links).toEqual(GD_HALLS.map((hall) => `/gd/halls/${hall.slug}`));
    for (const hall of GD_HALLS) {
      const { small } = hallFiles(hall);
      expect(html).toContain(`src="${small.path}"`);
    }
    expect(html.match(/loading="lazy"/g)).toHaveLength(14);
    expect(
      [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(([, heading]) =>
        text(heading),
      ),
    ).toEqual([
      "Neophyte 0=0",
      "Zelator 1=10",
      "Theoricus 2=9",
      "Practicus 3=8",
      "Philosophus 4=7",
      "Portal",
    ]);
    expect(html).not.toContain("Outer Order");
  });

  it("labels each card by part and place, with its grade for a screen reader", () => {
    const names = [...html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map(
      ([, inner]) =>
        text(
          inner.replace(/<span[^>]*aria-hidden="true"[^>]*>.*?<\/span>/g, ""),
        ),
    );
    expect(names).toEqual([
      "Neophyte 0=0, The hall",
      "Zelator 1=10, Part 1",
      "Zelator 1=10, Part 2",
      "Theoricus 2=9, Part 1, 32nd path",
      "Theoricus 2=9, Part 2, In Yesod",
      "Practicus 3=8, Part 1, 31st path",
      "Practicus 3=8, Part 2, 30th path",
      "Practicus 3=8, Part 3, In Hod",
      "Philosophus 4=7, Part 1, 29th path",
      "Philosophus 4=7, Part 2, 28th path",
      "Philosophus 4=7, Part 3, 27th path",
      "Philosophus 4=7, Part 4, In Netzach",
      "Portal, Part 1",
      "Portal, Part 2",
    ]);
  });

  it("leaves the h1 to the app bar and links the editor", () => {
    // The bar names the page ("Temple Halls") in its own h1.
    const page = renderToString(<HallsPage />);
    expect(page.match(/<h1\b/g)).toBeNull();
    expect(page.match(/<h2\b/g)).toHaveLength(1);
    expect(text(page)).toContain("Golden Dawn temple halls");
    expect(page).toMatch(/<a[^>]*href="\/gd\/halls\/editor"[^>]*>/);
    expect(text(page)).toContain("Open the editor");
  });
});
