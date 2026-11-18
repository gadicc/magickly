import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { precacheEntries } from "../../next.config";
import {
  bookUrl,
  MIRROR_WIDTH,
  MIRRORED_PAGES,
  type MirroredPage,
  mirrorPath,
  originalOf,
  pageUrl,
} from "./mirroredPages";

const PUBLIC = new URL("../../public/", import.meta.url);
const pages: MirroredPage[] = Object.values(MIRRORED_PAGES);
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
      // The mirror never enlarges: the 1823 Lenain page keeps its 1574.
      expect(page.output.width, page.id).toBe(
        Math.min(MIRROR_WIDTH, page.original.width),
      );
      expect(page.output.height, page.id).toBe(
        Math.round(
          (page.original.height * page.output.width) / page.original.width,
        ),
      );
    }
    expect(MIRRORED_PAGES.lenain25.output.width).toBe(1574);
  });

  // Raised from 1.5 MB on 18 November 2026 for Lenain's eight pages (plan
  // 033, "Other witnesses"): the two plates, Kircher's table and his p. 287,
  // and Agrippa's 1727 table, 2,356,672 bytes, Kircher's yellowed colour
  // scans the heaviest. 3.5 MB leaves room for a page or two more; past
  // that the mirror moves to the app's file storage (plan 080), not here.
  it("stay small: under 3.5 MB together", () => {
    const total = pages.reduce((sum, page) => sum + page.output.bytes, 0);
    expect(total).toBe(3000510);
    expect(total).toBeLessThan(3.5e6);
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
    expect(pageUrl(MIRRORED_PAGES.agrippa149)).toBe(
      "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up",
    );
    expect(bookUrl(MIRRORED_PAGES.heydon13)).toBe(
      "https://archive.org/details/theomagiaortempl00heyd",
    );
    // Opened on 18 November 2026: n278 to n280 show Kircher's pp. 271 to
    // 273, n294 p. 287, and n588 and n589 the 1727 Agrippa's pp. 109 and 110.
    expect(pageUrl(MIRRORED_PAGES.kircher287)).toBe(
      "https://archive.org/details/A027083/page/n294/mode/1up",
    );
    for (const page of pages)
      if (page.scan.site === "archive.org")
        expect(originalOf(page), page.id).toEqual({
          url: `https://archive.org/download/${page.scan.item}/page/n${page.scan.leaf}.jpg`,
        });
  });

  it("link their pages and books on Google Books, whose originals are kept by hand", () => {
    expect(pageUrl(MIRRORED_PAGES.lenain25)).toBe(
      "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA25",
    );
    expect(pageUrl(MIRRORED_PAGES.lenainReissue25)).toBe(
      "https://books.google.com/books?id=ZqgpxTZ43HkC&pg=PA25",
    );
    expect(bookUrl(MIRRORED_PAGES.lenain25)).toBe(
      "https://books.google.com/books?id=qt9SAAAAcAAJ",
    );
    expect(originalOf(MIRRORED_PAGES.lenainReissue25)).toEqual({
      file: "googlebooks-ZqgpxTZ43HkC-PA25.png",
    });
  });

  it("are each recorded in the README, with both hashes", () => {
    const readme = file("/sources/README.md").toString();
    for (const page of pages) {
      expect(readme, page.id).toContain(`${page.id}.webp`);
      expect(readme, page.id).toContain(page.original.sha256);
      expect(readme, page.id).toContain(page.output.sha256);
      expect(readme, page.id).toContain(`| ${page.output.bytes} |`);
      expect(readme, page.id).toContain(pageUrl(page));
    }
    const total = pages.reduce((sum, page) => sum + page.output.bytes, 0);
    expect(readme).toContain(`Total: ${total} bytes`);
    expect(readme).toContain("digitised by Google Books");
  });

  it("stay out of the service worker's precache", () => {
    const urls = precacheEntries().map((entry) => entry.url);
    expect(urls.some((url) => url.startsWith("/sources/"))).toBe(false);
    // The rest of public/ is still there.
    expect(urls).toContain("/fonts/FrankRuhlLibre.css");
  });
});
