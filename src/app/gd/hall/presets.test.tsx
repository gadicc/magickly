import { GdHall, validateHall } from "@magick-components/gd/hall";
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { inventoryRitualAssets } from "@/offline/ritualAssetInventory";
import { gdHallArt } from "./art";

const render = (hall: (typeof HALL_PRESETS)[number]["hall"]) =>
  renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);

describe.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
  "the %s preset",
  (id, preset) => {
    it("validates with no errors or warnings against the app's art", () => {
      expect(validateHall(preset.hall, { art: gdHallArt })).toEqual([]);
    });

    it("says where its layout comes from", () => {
      expect(preset.sources.length).toBeGreaterThan(0);
      expect(preset.sources).toContain(`public/pics/${id}.svg`);
      for (const source of preset.sources)
        expect(source).toMatch(
          /^(public\/pics\/\w+\.svg|Regardie 1938, vol\. 2, archive\.org IsraelRegardie-TheGoldenDawn-Vol2-1938, p\.\d+, leaf n\d+)$/,
        );
    });

    it("draws the same SVG every time, with the app's art", async () => {
      const markup = render(preset.hall);
      expect(render(preset.hall)).toBe(markup);
      // Every tag drawn: no placeholder for missing art.
      expect(markup).not.toContain('stroke-dasharray="6 4"');
      expect(markup).toContain(`>${preset.title}</title>`);
      // One tag per line, so a change reads as a small diff.
      await expect(markup.replaceAll("><", ">\n<")).toMatchFileSnapshot(
        `./__snapshots__/${id}.svg`,
      );
    });

    it("loads nothing: no images, and references only within itself", () => {
      const markup = render(preset.hall);
      expect(markup).not.toMatch(/<image|<img|xlink:href/i);
      const ids = new Set(
        [...markup.matchAll(/\sid="([^"]+)"/g)].map(([, value]) => value),
      );
      for (const [, href] of markup.matchAll(/\shref="([^"]*)"/g)) {
        expect(href.startsWith("#"), href).toBe(true);
        expect(ids.has(href.slice(1)), href).toBe(true);
      }
      for (const [, url] of markup.matchAll(/url\(([^)]*)\)/g))
        expect(ids.has(url.replace(/^#/, "")), url).toBe(true);
      expect(
        markup.replaceAll('xmlns="http://www.w3.org/2000/svg"', ""),
      ).not.toMatch(/https?:|\/\//);
    });

    it("passes the offline asset inventory as a compiled ritual", () => {
      // A ritual whose only content is the hall, as the reader holds it.
      const inventory = inventoryRitualAssets(
        { children: [preset.hall] },
        { knownAppOrigins: ["https://magick.ly"], staticPaths: [] },
      );
      expect(inventory.issues).toEqual([]);
      expect(inventory.occurrences).toEqual([]);
      expect(inventory.enumerationComplete).toBe(true);
    });
  },
);

describe("the presets", () => {
  it("have unique ids and titles, each its caption", () => {
    const ids = HALL_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual([
      "neophyte",
      "zelator1",
      "zelator2",
      "theoricus1",
      "theoricus2",
    ]);
    for (const preset of HALL_PRESETS) {
      const caption = preset.hall.children?.find(
        (child) => child.type === "caption",
      );
      expect(caption?.text, preset.id).toBe(preset.title);
    }
  });
});
