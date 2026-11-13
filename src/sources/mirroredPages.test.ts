import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { precacheEntries } from "../../next.config";
import {
  archiveBookUrl,
  archivePageUrl,
  MIRROR_WIDTH,
  MIRRORED_PAGES,
  mirrorPath,
} from "./mirroredPages";

const PUBLIC = new URL("../../public/", import.meta.url);
const pages = Object.values(MIRRORED_PAGES);
const file = (path: string) => readFileSync(new URL(`.${path}`, PUBLIC));

describe("the mirrored source pages", () => {
  it("are the files the manifest records, and nothing else", () => {
    expect(readdirSync(new URL("sources/", PUBLIC)).sort()).toEqual(
      ["README.md", ...pages.map((page) => `${page.id}.webp`)].sort(),
    );
    for (const page of pages) {
      const bytes = file(mirrorPath(page));
      expect(bytes.length, page.id).toBe(page.output.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), page.id).toBe(
        page.output.sha256,
      );
    }
  });

  it("are WebP, as wide as the mirror makes them, in the original's proportions", async () => {
    for (const page of pages) {
      const meta = await sharp(file(mirrorPath(page))).metadata();
      expect(meta.format, page.id).toBe("webp");
      expect([meta.width, meta.height], page.id).toEqual([
        page.output.width,
        page.output.height,
      ]);
      expect(page.output.width).toBe(MIRROR_WIDTH);
      expect(page.output.height).toBe(
        Math.round((page.original.height * MIRROR_WIDTH) / page.original.width),
      );
    }
  });

  it("stay small: under 1.5 MB together", () => {
    const total = pages.reduce((sum, page) => sum + page.output.bytes, 0);
    expect(total).toBe(643838);
    expect(total).toBeLessThan(1.5e6);
  });

  it("outline a region on the page", () => {
    for (const { id, highlight } of pages) {
      expect(highlight.x, id).toBeGreaterThanOrEqual(0);
      expect(highlight.y, id).toBeGreaterThanOrEqual(0);
      expect(highlight.width, id).toBeGreaterThan(0);
      expect(highlight.height, id).toBeGreaterThan(0);
      expect(highlight.x + highlight.width, id).toBeLessThanOrEqual(1);
      expect(highlight.y + highlight.height, id).toBeLessThanOrEqual(1);
    }
  });

  it("link their leaves and books on archive.org", () => {
    expect(archivePageUrl(MIRRORED_PAGES.agrippa149)).toBe(
      "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up",
    );
    expect(archiveBookUrl(MIRRORED_PAGES.heydon13)).toBe(
      "https://archive.org/details/theomagiaortempl00heyd",
    );
    for (const page of pages)
      expect(page.original.url, page.id).toBe(
        `https://archive.org/download/${page.item}/page/n${page.leaf}.jpg`,
      );
  });

  it("are each recorded in the README, with both hashes", () => {
    const readme = file("/sources/README.md").toString();
    for (const page of pages) {
      expect(readme, page.id).toContain(`${page.id}.webp`);
      expect(readme, page.id).toContain(page.original.sha256);
      expect(readme, page.id).toContain(page.output.sha256);
      expect(readme, page.id).toContain(`| ${page.output.bytes} |`);
      expect(readme, page.id).toContain(archivePageUrl(page));
    }
  });

  it("stay out of the service worker's precache", () => {
    const urls = precacheEntries().map((entry) => entry.url);
    expect(urls.some((url) => url.startsWith("/sources/"))).toBe(false);
    // The rest of public/ is still there.
    expect(urls).toContain("/fonts/FrankRuhlLibre.css");
  });
});
