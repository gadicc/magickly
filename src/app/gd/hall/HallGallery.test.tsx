import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";
import HallGallery from "./HallGallery";

describe("/gd/hall's presets", () => {
  const html = renderToString(<HallGallery />);

  it("links every hall's page with its lazy thumbnail, by grade", () => {
    expect(html).toContain('id="halls"');
    const links = [...html.matchAll(/<a[^>]*href="(\/gd\/hall\/[^"]+)"/g)].map(
      ([, href]) => href,
    );
    expect(links).toEqual(GD_HALLS.map((hall) => `/gd/hall/${hall.slug}`));
    for (const hall of GD_HALLS) {
      const { small } = hallFiles(hall);
      expect(html).toContain(`src="${small.path}"`);
    }
    expect(html.match(/loading="lazy"/g)).toHaveLength(14);
    expect(
      [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(([, grade]) => grade),
    ).toEqual([
      "Neophyte 0=0",
      "Zelator 1=10",
      "Theoricus 2=9",
      "Practicus 3=8",
      "Philosophus 4=7",
      "Portal",
    ]);
    // Each link names its grade too, for a screen reader.
    const names = [...html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map(
      ([, inner]) => inner.replace(/<[^>]+>/g, ""),
    );
    expect(names).toContain("Theoricus 2=9, 32nd path");
    expect(names).toContain("Philosophus 4=7, In Netzach");
    expect(names).toContain("Neophyte 0=0, The hall");
    expect(names).toContain("Portal, Part 2");
  });
});
