/**
 * Builds `src/geo/server/places.tsv`, the place search's data (plan 072),
 * from GeoNames' `cities15000.zip` and `admin1CodesASCII.txt` as captured
 * on archive.org on 10 November 2026. Source, licence and changes are in
 * `src/geo/server/README.md`.
 *
 *   node_modules/.bin/tsx scripts/geonames/build.ts
 *   node_modules/.bin/tsx scripts/geonames/build.ts --from <dir>
 *
 * `--from` reads both files from a directory instead of downloading them.
 * Either way each file must match its SHA-256 below, or nothing is written.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildPlacesTsv, readSingleEntryZip } from "./geonames";

/**
 * GeoNames' dump changes daily, so the build reads archive.org's copies
 * (the `id_` form returns the raw bytes) and pins them by hash. To move to
 * a newer dump, archive the new files, then update these and the README.
 */
const SOURCES = {
  cities: {
    file: "cities15000.zip",
    url: "https://web.archive.org/web/20261110090942id_/https://download.geonames.org/export/dump/cities15000.zip",
    sha256: "0df068fe1eb445f18655559b9d80fdd45ac88535d8c27b7b4f5ce5e66b1107b3",
  },
  admin1: {
    file: "admin1CodesASCII.txt",
    url: "https://web.archive.org/web/20261110091031id_/https://download.geonames.org/export/dump/admin1CodesASCII.txt",
    sha256: "2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3",
  },
} as const;

const SOURCE_NOTE =
  "GeoNames cities15000.zip and admin1CodesASCII.txt, downloaded 10 November 2026";

type Source = (typeof SOURCES)[keyof typeof SOURCES];

async function fetchSource(source: Source, from: string | undefined) {
  let bytes: Buffer;
  if (from) {
    bytes = readFileSync(join(from, source.file));
  } else {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`${source.url}: HTTP ${response.status}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== source.sha256) {
    throw new Error(
      `${source.file}: SHA-256 ${sha256}, expected ${source.sha256}; refusing other bytes`,
    );
  }
  console.log(`${source.file}: ${bytes.length} bytes, sha256 ${sha256}`);
  return bytes;
}

async function main() {
  const { values } = parseArgs({
    options: { from: { type: "string" }, out: { type: "string" } },
  });
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = resolve(root, values.out ?? "src/geo/server/places.tsv");

  const zip = await fetchSource(SOURCES.cities, values.from);
  const admin1 = await fetchSource(SOURCES.admin1, values.from);
  const cities = readSingleEntryZip(zip, "cities15000.txt").toString("utf8");
  const tsv = buildPlacesTsv(cities, admin1.toString("utf8"), SOURCE_NOTE);

  writeFileSync(output, tsv);
  const sha256 = createHash("sha256").update(tsv).digest("hex");
  const rows = tsv.split("\n").length - 2;
  console.log(
    `${output}: ${rows} places, ${Buffer.byteLength(tsv)} bytes, sha256 ${sha256}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
