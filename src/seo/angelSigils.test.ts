import angels from "magick-data/kabbalah/seventyTwoAngels";
import { describe, expect, it } from "vitest";
import { angelSlug } from "@/lib/angelSlugs";
import { canonicalSigilText } from "@/render/contracts/roseSigil";
import {
  allAngelSigilFiles,
  angelSigilFiles,
  angelSigilQuery,
  angelSigilText,
} from "./angelSigils";

const vehuiah = angels[0];

describe("the angels' sigil files", () => {
  it("draws each of the 72 from the site's spelling, which needs no change", () => {
    for (const angel of angels) {
      expect(angel.name.he, String(angel.no)).toBeTruthy();
      expect(angelSigilText(angel)).toBe(angel.name.he);
      expect(canonicalSigilText(angelSigilText(angel))).toBe(angel.name.he);
    }
  });

  it("names two files under each angel's page, the PNG first", () => {
    const files = allAngelSigilFiles();
    expect(files).toHaveLength(144);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(144);
    for (const { slug, angel, file } of files) {
      expect(slug).toBe(angelSlug(angel.no));
      expect(file.path).toBe(`/kabbalah/angel/${slug}/${file.name}`);
      expect(file.name).toMatch(/^[a-z0-9-]+-rose-cross-sigil\.(?:png|svg)$/);
    }
    expect(angelSigilFiles(vehuiah)).toEqual({
      png: {
        name: "vehuiah-rose-cross-sigil.png",
        path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png",
        format: "png",
        width: 1024,
        height: 1024,
      },
      svg: {
        name: "vehuiah-rose-cross-sigil.svg",
        path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.svg",
        format: "svg",
      },
    });
  });

  it("asks for the default rose, shown, at the raster default", () => {
    const { png, svg } = angelSigilFiles(vehuiah);
    expect(angelSigilQuery(vehuiah, png).toString()).toBe(
      `text=${encodeURIComponent("והויה")}&fmt=png`,
    );
    expect(angelSigilQuery(vehuiah, svg).toString()).toBe(
      `text=${encodeURIComponent("והויה")}`,
    );
  });
});
