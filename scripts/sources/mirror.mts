/**
 * Mirrors the cited public-domain pages into public/sources/ (see
 * src/sources/mirroredPages.ts and public/sources/README.md).
 *
 *   pnpm sources:mirror [--download-dir <dir>]
 *
 * Downloads each leaf's full-size JPEG from archive.org into a new, empty
 * directory (a fresh temporary one unless --download-dir names one, which
 * must not exist yet), checks its SHA-256 against the manifest, and writes
 * a WebP MIRROR_WIDTH pixels wide at MIRROR_QUALITY. The downloads are
 * untrusted data: they are only hashed and decoded by sharp, never run.
 * Exits 1 if a download's hash differs, or if an output differs from what
 * the manifest records (printing the new values to record after review).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";
import {
  MIRROR_QUALITY,
  MIRROR_WIDTH,
  MIRRORED_PAGES,
} from "../../src/sources/mirroredPages.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { values } = parseArgs({
  options: { "download-dir": { type: "string" } },
});
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

let downloads: string;
if (values["download-dir"]) {
  downloads = resolve(values["download-dir"]);
  if (existsSync(downloads))
    throw new Error(`${downloads} exists; name a new directory`);
  mkdirSync(downloads, { recursive: true });
} else downloads = mkdtempSync(join(tmpdir(), "magickli-sources-"));
const outDir = resolve(root, "public/sources");
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const page of Object.values(MIRRORED_PAGES)) {
  const response = await fetch(page.original.url, { redirect: "follow" });
  if (!response.ok)
    throw new Error(`${page.original.url}: HTTP ${response.status}`);
  const original = new Uint8Array(await response.arrayBuffer());
  writeFileSync(join(downloads, `${page.id}.jpg`), original);
  const hash = sha256(original);
  if (hash !== page.original.sha256) {
    console.error(
      `${page.id}: the download's SHA-256 is ${hash}, not ${page.original.sha256}; nothing written`,
    );
    failed = true;
    continue;
  }
  const meta = await sharp(original).metadata();
  if (
    meta.width !== page.original.width ||
    meta.height !== page.original.height
  )
    throw new Error(
      `${page.id}: ${meta.width}×${meta.height} is not the manifest's`,
    );
  const { data, info } = await sharp(original)
    .resize({ width: MIRROR_WIDTH })
    .webp({ quality: MIRROR_QUALITY })
    .toBuffer({ resolveWithObject: true });
  writeFileSync(join(outDir, `${page.id}.webp`), data);
  const output = {
    width: info.width,
    height: info.height,
    bytes: data.length,
    sha256: sha256(data),
  };
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
