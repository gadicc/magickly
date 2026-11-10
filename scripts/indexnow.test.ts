import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  changedUrls,
  ENDPOINT,
  KEY,
  KEY_LOCATION,
  pageFingerprint,
  sitemapUrls,
  snapshot,
  submit,
} from "./indexnow.mjs";

const page = (body: string, head = "") =>
  `<!DOCTYPE html><html><head><title>Tree</title>` +
  `<meta name="description" content="The Tree of Life"/>${head}` +
  `<script src="/_next/static/chunks/main-abc.js"></script></head>` +
  `<body class="x">${body}<script>self.__next_f.push([1,"abc"])</script></body></html>`;

describe("pageFingerprint", () => {
  it("ignores what each build renames: chunks, class names, inline payloads", () => {
    const a = page(`<p class="mui-1abc">Keter</p><a href="/kabbalah">K</a>`);
    const b = page(`<p class="mui-9xyz">Keter</p><a href="/kabbalah">K</a>`)
      .replace("main-abc.js", "main-def.js")
      .replace('"abc"', '"def"');
    expect(pageFingerprint(a)).toBe(pageFingerprint(b));
  });

  it("changes with the text, a heading level, a link, an image, the description or JSON-LD", () => {
    const base = page(
      `<h6>Keter</h6><a href="/a">A</a><img src="/t.png" alt="Tree"/>`,
    );
    const variants = [
      base.replace("Keter", "Kether"),
      base.replace("<h6>Keter</h6>", "<h2>Keter</h2>"),
      base.replace('href="/a"', 'href="/b"'),
      base.replace('alt="Tree"', 'alt="The Tree"'),
      base.replace("The Tree of Life", "The Tree of Life, drawn"),
      base.replace(
        "</head>",
        '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script></head>',
      ),
    ];
    for (const variant of variants)
      expect(pageFingerprint(variant)).not.toBe(pageFingerprint(base));
  });

  it("reads character references as the text they stand for", () => {
    expect(pageFingerprint(page("<p>Don&apos;t</p>"))).toBe(
      pageFingerprint(page("<p>Don&#x27;t</p>")),
    );
  });
});

describe("sitemapUrls", () => {
  it("lists our own pages, unescaped, and nothing from another host", () => {
    const xml =
      "<urlset><url><loc>https://magick.ly</loc></url>" +
      "<url><loc>https://magick.ly/gd/grade/0=0</loc></url>" +
      "<url><loc>https://magick.ly/a?b=1&amp;c=2</loc></url>" +
      "<url><loc>https://example.com/x</loc></url></urlset>";
    expect(sitemapUrls(xml)).toEqual([
      "https://magick.ly",
      "https://magick.ly/gd/grade/0=0",
      "https://magick.ly/a?b=1&c=2",
    ]);
  });
});

describe("changedUrls", () => {
  it("submits changed, added and removed pages, never unknown ones", () => {
    const before = {
      pages: {
        "/same": "1",
        "/edit": "1",
        "/gone": "1",
        "/failed": null,
        "/later": "1",
      },
    };
    const after = {
      pages: {
        "/same": "1",
        "/edit": "2",
        "/new": "1",
        "/failed": "1",
        "/later": null,
      },
    };
    expect(changedUrls(before, after)).toEqual(["/edit", "/gone", "/new"]);
  });
});

describe("snapshot", () => {
  it("fingerprints each sitemap page and records failures as null", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml"))
        return new Response(
          "<loc>https://magick.ly/a</loc><loc>https://magick.ly/b</loc>",
        );
      if (url.endsWith("/b")) return new Response("", { status: 500 });
      return new Response(page("<p>A</p>"));
    });
    const result = await snapshot({ fetch: fetch as typeof globalThis.fetch });
    expect(result.pages["https://magick.ly/a"]).toMatch(/^[0-9a-f]{64}$/);
    expect(result.pages["https://magick.ly/b"]).toBeNull();
  });
});

describe("submit", () => {
  it("sends nothing when nothing changed", async () => {
    const fetch = vi.fn();
    expect(await submit([], { fetch })).toBe("nothing changed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the list with our host and key, and accepts 202", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await submit(["https://magick.ly/a"], { fetch })).toBe(
      "submitted 1 (HTTP 202)",
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(JSON.parse(init.body as string)).toEqual({
      host: "magick.ly",
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: ["https://magick.ly/a"],
    });
  });

  it("fails on any other answer", async () => {
    const fetch = vi.fn(async () => new Response("bad key", { status: 403 }));
    await expect(submit(["https://magick.ly/a"], { fetch })).rejects.toThrow(
      "IndexNow answered 403",
    );
  });
});

describe("the key file", () => {
  it("is served from the site root and holds the key", () => {
    const file = join(import.meta.dirname, "../public", `${KEY}.txt`);
    expect(readFileSync(file, "utf8").trim()).toBe(KEY);
    expect(KEY_LOCATION).toBe(`https://magick.ly/${KEY}.txt`);
  });
});
