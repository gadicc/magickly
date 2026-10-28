import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gdHallPug } from "@/doc/gdHallPug";
import {
  isPresetHash,
  isShareHash,
  MAX_SHARE_FRAGMENT,
  MAX_SHARED_BYTES,
  presetHashSlug,
  readShareHash,
  ShareLinkError,
  shareFragment,
} from "./hallShare";

afterEach(() => vi.unstubAllGlobals());

const fragmentOf = async (pug: string) => {
  const result = await shareFragment(pug);
  if (!("fragment" in result)) throw new Error("too long");
  return result.fragment;
};

/** Raw deflate of bytes, base64url. */
async function deflated(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const buffer = new Uint8Array(await new Response(stream).arrayBuffer());
  return Buffer.from(buffer).toString("base64url");
}

describe("share links", () => {
  it.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "carry the %s hall compressed, and give it back",
    async (_id, preset) => {
      const pug = gdHallPug(preset.hall);
      const fragment = await fragmentOf(pug);
      expect(fragment).toMatch(/^hall=1\.[A-Za-z0-9_-]+$/);
      // Compressed: far shorter than the text it carries.
      expect(fragment.length).toBeLessThan(pug.length);
      expect(isShareHash(`#${fragment}`)).toBe(true);
      expect(await readShareHash(`#${fragment}`)).toBe(pug);
    },
  );

  it("fall back to plain text where compression streams are missing", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const pug = 'gdHall\n  caption(text="Ἱεροφάντης 🜂")\n';
    const fragment = await fragmentOf(pug);
    expect(fragment).toMatch(/^hall=0\./);
    expect(await readShareHash(fragment)).toBe(pug);
    // A compressed link needs decompression.
    vi.unstubAllGlobals();
    const compressed = await fragmentOf(pug);
    vi.stubGlobal("DecompressionStream", undefined);
    await expect(readShareHash(compressed)).rejects.toThrow(
      "this browser cannot unpack it",
    );
  });

  it("refuse a hall too large to share, saying how long it would be", async () => {
    let seed = 1;
    const noise = () => {
      seed = (seed * 48271) % 2147483647;
      return seed.toString(36);
    };
    const pug = `gdHall\n  floor\n${Array.from(
      { length: 1500 },
      () => `    marker(text="${noise()}${noise()}")\n`,
    ).join("")}`;
    const result = await shareFragment(pug);
    expect(result).toEqual({ tooLong: expect.any(Number) });
    expect((result as { tooLong: number }).tooLong).toBeGreaterThan(
      MAX_SHARE_FRAGMENT,
    );
  });

  it("refuse a hall that packs well but is too large to read quickly", async () => {
    // The review's link: 8,400 markers, 260 KB, in 934 characters, which
    // took seconds to read and lay out.
    const pug = `gdHall\n  floor\n${'    marker(text="a", x=1, y=1)\n'.repeat(8400)}`;
    expect(await shareFragment(pug)).toEqual({ tooLarge: pug.length });
    const link = await deflated(new TextEncoder().encode(pug));
    expect(link.length).toBeLessThan(1000);
    await expect(readShareHash(`#hall=1.${link}`)).rejects.toThrow(
      "it unpacks to more than 64 KB, more than a shared hall may hold",
    );
    expect(MAX_SHARED_BYTES).toBe(64 * 1024);
  });

  it("refuse links that are not halls, too long, damaged or bombs", async () => {
    expect(isShareHash("#other=1")).toBe(false);
    const fails = (hash: string, message: string | RegExp) =>
      expect(readShareHash(hash)).rejects.toThrow(message);
    await fails("#other", "it is not a hall link");
    await fails(`#hall=1.${"A".repeat(MAX_SHARE_FRAGMENT)}`, /longer than/);
    await fails("#hall=2.AAAA", "it is not in a format this page reads");
    await fails("#hall=1.%%%", "it is damaged");
    await fails("#hall=1.AAAAAAAA", "it is damaged");
    // Not UTF-8.
    await fails(
      `#hall=0.${Buffer.from([0xff, 0xfe]).toString("base64url")}`,
      "it is damaged",
    );
    // Deflate unpacking to more than a hall may hold.
    const bomb = await deflated(new Uint8Array(MAX_SHARED_BYTES + 1));
    expect(bomb.length).toBeLessThan(MAX_SHARE_FRAGMENT);
    await fails(
      `#hall=1.${bomb}`,
      "it unpacks to more than 64 KB, more than a shared hall may hold",
    );
    const plain = Buffer.from("x".repeat(MAX_SHARED_BYTES + 1)).toString(
      "base64url",
    );
    expect(plain.length).toBeGreaterThan(MAX_SHARE_FRAGMENT);
    await expect(readShareHash("#hall=1.!")).rejects.toBeInstanceOf(
      ShareLinkError,
    );
  });

  it("leave the text itself for the parser to judge", async () => {
    const fragment = await fragmentOf("p <script>alert(1)</script>\n");
    expect(await readShareHash(fragment)).toBe("p <script>alert(1)</script>\n");
  });
});

describe("preset links (plan 062)", () => {
  it("reads #preset=<slug>, at most 40 characters of it", () => {
    expect(isPresetHash("#preset=zelator-1")).toBe(true);
    expect(isPresetHash("preset=")).toBe(true);
    expect(isPresetHash("#hall=1.abc")).toBe(false);
    expect(presetHashSlug("#preset=zelator-1")).toBe("zelator-1");
    expect(presetHashSlug(`#preset=${"x".repeat(100)}`)).toHaveLength(40);
  });
});
