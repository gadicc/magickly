import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderComponentImage } from "@/render/componentImage";
import * as spirit from "../../../spirit/[id]/[file]/route";
import { GET, generateStaticParams } from "./route";

const get = (id: string, file: string) =>
  GET(new Request("https://magick.ly/astrology/intelligence"), {
    params: Promise.resolve({ id, file }),
  });

describe("/astrology/intelligence/[id]/[file] and /astrology/spirit/[id]/[file]", () => {
  it("prerenders a PNG and an SVG for each name in its own namespace", () => {
    const intelligences = generateStaticParams();
    const spirits = spirit.generateStaticParams();
    expect(intelligences).toHaveLength(16);
    expect(spirits).toHaveLength(16);
    expect(intelligences.slice(0, 2)).toEqual([
      { id: "agiel", file: "sigil-of-agiel.png" },
      { id: "agiel", file: "sigil-of-agiel.svg" },
    ]);
    expect(intelligences).toContainEqual({
      id: "malcha-betharsisim",
      file: "sigil-of-malcha-betharsisim.svg",
    });
    expect(spirits).toContainEqual({
      id: "schedbarschemoth-schartathan",
      file: "sigil-of-schedbarschemoth-schartathan.png",
    });
    expect(spirits.some(({ id }) => id === "agiel")).toBe(false);
  });

  it("serves the bytes the kamea-sigil route draws for the traced spelling", async () => {
    const png = await get("agiel", "sigil-of-agiel.png");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toBe(
      'inline; filename="sigil-of-agiel.png"',
    );
    expect(png.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(png.headers.get("x-robots-tag")).toBeNull();
    const bytes = Buffer.from(await png.arrayBuffer());
    const drawn = await renderComponentImage(
      "kamea-sigil",
      new URLSearchParams({ planet: "saturn", text: "אגיאל", fmt: "png" }),
    );
    expect(bytes.equals(drawn.bytes)).toBe(true);
    expect(png.headers.get("etag")).toBe(
      `"${createHash("sha256").update(bytes).digest("hex")}"`,
    );
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: 1024,
      height: 1024,
    });

    const svg = await spirit.GET(new Request("https://magick.ly/"), {
      params: Promise.resolve({
        id: "schedbarschemoth-schartathan",
        file: "sigil-of-schedbarschemoth-schartathan.svg",
      }),
    });
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    // Decision 10: divided, two squares in one row.
    expect(await svg.text()).toBe(
      (
        await renderComponentImage(
          "kamea-sigil",
          new URLSearchParams({ planet: "luna", text: "שדברשהמעת שרתתן" }),
        )
      ).bytes.toString("utf8"),
    );
  });

  it("answers 404 for any other file, or a name in the other namespace", async () => {
    for (const [id, file] of [
      ["agiel", "sigil-of-zazel.png"],
      ["agiel", "sigil-of-agiel.jpg"],
      ["zazel", "sigil-of-zazel.png"],
      ["shelachel", "sigil-of-shelachel.png"],
      ["saturn-ab", "sigil-of-saturn-ab.png"],
    ])
      expect((await get(id, file)).status, `${id}/${file}`).toBe(404);
  });
});
