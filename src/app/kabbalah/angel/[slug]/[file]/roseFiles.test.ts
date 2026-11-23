import { createHash } from "node:crypto";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { angelSlug } from "@/lib/angelSlugs";
import { GET } from "./route";

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * The 72 angels' rose sigils as their files draw them (plan 096, "the rose
 * does not change"): one SHA-256 over every outlined SVG, each named by
 * its file, in the angels' order. Taken on `main`'s bytes (92b325f0)
 * before the sigil styles changed anything, under the shipped
 * `magickli-rose-sigil-image-v1`, so it adds coverage and re-pins
 * nothing. The registry's `ROSE_SIGIL_PINS` hold four texts' bytes and
 * `ROSE_SIGIL_DRAWING_DIGESTS` the path data; this holds the 72 files
 * themselves, through the route that serves them. A correction to a
 * name's Hebrew moves it, as it moves that angel's file.
 */
const ANGEL_ROSE_SVGS_SHA256 =
  "89dac30f98c3a7d55a90398e1a7233ea9d882f8347252a6b1a1528df4c953d2e";

describe("the 72 angels' rose sigil files", () => {
  it("draw the bytes main drew", async () => {
    const lines: string[] = [];
    for (const angel of angels) {
      const slug = angelSlug(angel.no);
      const name = `${slug}-rose-cross-sigil.svg`;
      const response = await GET(
        new Request(`https://magick.ly/kabbalah/angel/${slug}/${name}`),
        { params: Promise.resolve({ slug, file: name }) },
      );
      expect(response.status, name).toBe(200);
      lines.push(
        `${name}\t${sha256(new Uint8Array(await response.arrayBuffer()))}\n`,
      );
    }
    expect(lines).toHaveLength(72);
    expect(sha256(lines.join(""))).toBe(ANGEL_ROSE_SVGS_SHA256);
  }, 120_000);
});
