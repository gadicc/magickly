/**
 * Mirrors the cited public-domain pages into public/sources/ (see
 * src/sources/mirroredPages.ts and public/sources/README.md).
 *
 *   pnpm sources:mirror --originals <dir> [--download-dir <dir>]
 *
 * Downloads each archive.org leaf's full-size JPEG, and each Wikimedia
 * Commons original, into a new, empty directory (a fresh temporary one
 * unless --download-dir names one, which must not exist yet). Google Books
 * pages cannot be downloaded by a script (their image URLs carry a
 * short-lived signature), so they are read from --originals, a directory of
 * page images fetched by hand and kept outside the repository, under the
 * names `originalOf` gives; without it, they are skipped and the run fails.
 * A Commons original whose download is refused (HTTP 403 or 429, or a
 * failed request) is read from there too, under the name `keptCopyName`
 * gives; any other failed status stops the run. Each original's SHA-256 and size are
 * checked against the manifest, and a WebP is written MIRROR_WIDTH pixels
 * wide (never wider than the original) at MIRROR_QUALITY. The steps that need no
 * network are in ./originals.ts. The originals are untrusted data: they are
 * only hashed and decoded by sharp, never run. Exits 1 if an original is
 * missing or differs from the manifest's, or if an output differs from what
 * the manifest records (printing the new values to record after review).
 */
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  MIRRORED_PAGES,
  type MirroredPage,
  originalOf,
} from "../../src/sources/mirroredPages.ts";
import {
  encodeMirror,
  originalProblem,
  readHandFetched,
  readKeptCopy,
} from "./originals.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { values } = parseArgs({
  options: {
    "download-dir": { type: "string" },
    originals: { type: "string" },
  },
});

let downloads: string;
if (values["download-dir"]) {
  downloads = resolve(values["download-dir"]);
  if (existsSync(downloads))
    throw new Error(`${downloads} exists; name a new directory`);
  mkdirSync(downloads, { recursive: true });
} else downloads = mkdtempSync(join(tmpdir(), "magickli-sources-"));
const originals = values.originals ? resolve(values.originals) : undefined;
const outDir = resolve(root, "public/sources");
mkdirSync(outDir, { recursive: true });

/** What the script calls itself to the sites it downloads from. */
const USER_AGENT = "magickli-sources-mirror/1.0 (+https://magick.ly)";

/** Statuses that mean "not to this client, now", not "no such file". */
const REFUSED = new Set([403, 429]);

/**
 * The page's original, downloaded or read from --originals; or why not.
 * A downloadable original is fetched first. Only where the site refuses
 * the script (403 or 429) or the request itself fails is a copy kept in
 * --originals read instead; any other status fails the run. Either way the
 * hash is checked, and which source was used is printed.
 */
async function originalBytes(
  page: MirroredPage,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  const source = originalOf(page);
  if ("file" in source) {
    console.log(`${page.id}: read from --originals`);
    return readHandFetched(page, originals);
  }
  let response: Response | undefined;
  let failure = "";
  try {
    response = await fetch(source.url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (error) {
    // Node's fetch says only "fetch failed"; the cause says why.
    const cause = error instanceof Error ? (error.cause as Error) : undefined;
    failure = `${error instanceof Error ? error.message : String(error)}${
      cause ? `: ${(cause as { code?: string }).code ?? cause.message}` : ""
    }`;
  }
  if (response?.ok) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    writeFileSync(join(downloads, `${page.id}.jpg`), bytes);
    console.log(`${page.id}: downloaded from ${source.url}`);
    return { bytes };
  }
  if (response && !REFUSED.has(response.status))
    throw new Error(`${source.url}: HTTP ${response.status}`);
  const refused = response ? `HTTP ${response.status}` : failure;
  // Wikimedia has answered Node's fetch with 429 while serving curl the
  // same file (19 November 2026), so a copy fetched by hand stands in.
  const kept = readKeptCopy(page, originals);
  if (!kept)
    return {
      error: `${page.id}: ${source.url} refused (${refused}), and no copy is kept in --originals`,
    };
  console.log(
    `${page.id}: ${source.url} refused (${refused}); read the copy kept in --originals`,
  );
  return kept;
}

let failed = false;
for (const page of Object.values(MIRRORED_PAGES) as MirroredPage[]) {
  const original = await originalBytes(page);
  if ("error" in original) {
    console.error(`${original.error}; nothing written`);
    failed = true;
    continue;
  }
  const problem = await originalProblem(page, original.bytes);
  if (problem) {
    console.error(`${problem}; nothing written`);
    failed = true;
    continue;
  }
  const { data, output } = await encodeMirror(original.bytes);
  writeFileSync(join(outDir, `${page.id}.webp`), data);
  const same = (Object.keys(output) as (keyof typeof output)[]).every(
    (key) => output[key] === page.output[key],
  );
  console.log(
    `${page.id}.webp ${JSON.stringify(output)}${same ? "" : " (differs from the manifest)"}`,
  );
  if (!same) failed = true;
}
console.log(`downloads kept in ${downloads}`);
if (failed) process.exit(1);
