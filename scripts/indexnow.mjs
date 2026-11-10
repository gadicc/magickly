import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * IndexNow tells Bing, Yandex and the other participating engines which
 * pages a release changed, so they recrawl those rather than waiting.
 * Google does not take part; it reads the sitemap.
 *
 * The release fingerprints every sitemap page on the live site before it
 * promotes a deployment and again after, and submits only the pages whose
 * fingerprint changed, appeared or disappeared, as the engines ask. Nothing
 * is kept between releases.
 *
 * The key is public by design: the engines fetch it from KEY_LOCATION to
 * confirm the site sent the list.
 */
export const ORIGIN = "https://magick.ly";
export const KEY = "59e45f4a549244c4155113ce01efa268";
export const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;
export const ENDPOINT = "https://api.indexnow.org/indexnow";

const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/**
 * What a search engine reads on a page: its title, description, canonical,
 * robots, structured data, headings, visible text, links and images. Scripts other
 * than JSON-LD, stylesheets and class names are left out, because every
 * build renames its chunks while the page stays the same.
 */
export function pageFingerprint(html) {
  const parts = [];
  const head = (pattern) => html.match(pattern)?.[1] ?? "";
  parts.push(`title ${head(/<title[^>]*>([\s\S]*?)<\/title>/i)}`);
  for (const name of ["description", "robots"])
    parts.push(
      `${name} ${head(new RegExp(`<meta name="${name}" content="([^"]*)"`, "i"))}`,
    );
  parts.push(`canonical ${head(/<link rel="canonical" href="([^"]*)"/i)}`);
  for (const [, json] of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  ))
    parts.push(`ld ${json}`);
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  for (const [, href] of body.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi))
    parts.push(`a ${href}`);
  for (const [tag] of body.matchAll(/<img\b[^>]*>/gi)) {
    const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? "";
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "";
    parts.push(`img ${src} ${alt}`);
  }
  // The outline: an h6 becoming an h2 changes how the page reads.
  parts.push(
    `headings ${[...body.matchAll(/<(h[1-6])\b/gi)].map(([, h]) => h.toLowerCase()).join(" ")}`,
  );
  parts.push(
    `text ${decode(body.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()}`,
  );
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** The page URLs a sitemap lists, unescaped, on our own origin only. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(([, url]) => decode(url.trim()))
    .filter((url) => url === ORIGIN || url.startsWith(`${ORIGIN}/`));
}

/**
 * Fingerprints every page the live sitemap lists. A page that fails to
 * load is recorded as null, so the comparison can tell "unknown" from
 * "changed".
 */
export async function snapshot({
  fetch = globalThis.fetch,
  concurrency = 8,
} = {}) {
  const response = await fetch(`${ORIGIN}/sitemap.xml`, {
    headers: { "user-agent": "magickli-indexnow" },
  });
  if (!response.ok) throw new Error(`The sitemap answered ${response.status}`);
  const urls = sitemapUrls(await response.text());
  if (urls.length === 0) throw new Error("The sitemap lists no pages");
  const pages = {};
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const page = await fetch(url, {
          headers: { "user-agent": "magickli-indexnow" },
          redirect: "manual",
        });
        pages[url] = page.ok ? pageFingerprint(await page.text()) : null;
      } catch {
        pages[url] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { pages };
}

/**
 * The URLs to submit: pages whose fingerprint changed, pages new to the
 * sitemap, and pages it no longer lists (the engines then find them gone).
 * A page that failed to load on either side is left out rather than
 * guessed at.
 */
export function changedUrls(before, after) {
  const changed = [];
  for (const [url, print] of Object.entries(after.pages)) {
    if (print === null) continue;
    if (!(url in before.pages)) changed.push(url);
    else if (before.pages[url] !== null && before.pages[url] !== print)
      changed.push(url);
  }
  for (const url of Object.keys(before.pages))
    if (!(url in after.pages)) changed.push(url);
  return changed.sort();
}

/** Sends the list in one request; the protocol takes up to 10,000. */
export async function submit(urls, { fetch = globalThis.fetch } = {}) {
  if (urls.length === 0) return "nothing changed";
  if (urls.length > 10_000)
    throw new Error(`${urls.length} URLs is over 10,000`);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(ORIGIN).host,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls,
    }),
  });
  // 200: received; 202: received, key not yet checked.
  if (response.status !== 200 && response.status !== 202)
    throw new Error(
      `IndexNow answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  return `submitted ${urls.length} (HTTP ${response.status})`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, file] = process.argv.slice(2);
  if (command === "snapshot" && file) {
    const before = await snapshot();
    writeFileSync(file, JSON.stringify(before));
    const missing = Object.values(before.pages).filter((p) => p === null);
    console.log(
      `Fingerprinted ${Object.keys(before.pages).length} pages (${missing.length} failed to load)`,
    );
  } else if (command === "submit" && file) {
    const before = JSON.parse(readFileSync(file, "utf8"));
    const after = await snapshot();
    const urls = changedUrls(before, after);
    for (const url of urls) console.log(url);
    console.log(await submit(urls));
  } else {
    console.error("Usage: node scripts/indexnow.mjs snapshot|submit <file>");
    process.exit(2);
  }
}
