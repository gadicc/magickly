import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { buildSearchCatalogue } from "../../src/search/catalogue";
import {
  EMBEDDING_PROFILES,
  embeddingInput,
  unitVector,
} from "../../src/search/embeddings/profiles";
import { embedSearchInputs } from "../../src/search/embeddings/provider";
import {
  fuseSearchResults,
  rankVectors,
} from "../../src/search/embeddings/rank";
import {
  catalogueDigest,
  digest,
  embeddingCacheKey,
  embeddingRecords,
} from "../../src/search/embeddings/records";
import type { SearchEmbeddingManifest } from "../../src/search/embeddings/store";
import { createSearchEngine } from "../../src/search/engine";
import { SEARCH_PROBES } from "./evaluation";

// Explicit task only: never a build hook, request-path ingestion or hidden charge.
const mode = process.argv[2];
if (mode !== "compare" && mode !== "publish")
  throw new Error("Use search:compare or search:publish <profile-key>");
const root = process.cwd();
const cache = resolve(root, ".private/site-search");
mkdirSync(cache, { recursive: true });
const catalogue = await buildSearchCatalogue();
const records = embeddingRecords(catalogue);
const lexical = createSearchEngine(catalogue);
const profiles =
  mode === "publish"
    ? EMBEDDING_PROFILES.filter((profile) => profile.key === process.argv[3])
    : EMBEDDING_PROFILES;
if (!profiles.length) throw new Error("Choose a registered embedding profile");
// Check live public pricing before any paid work; this task is deliberately small.
const listing = await fetch("https://ai-gateway.vercel.sh/v1/models", {
  signal: AbortSignal.timeout(20_000),
}).then((response) => response.json());
const maxEstimate = profiles.reduce((total, profile) => {
  const model = listing.data.find(
    (entry: { id: string }) => entry.id === profile.model,
  );
  const price = Number(model?.pricing?.input);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error("Cannot verify model price");
  const bytes = records.reduce(
    (sum, record) =>
      sum +
      Buffer.byteLength(
        embeddingInput(profile, "document", record.text, record.title),
      ) +
      256,
    0,
  );
  return total + (bytes * 2 + 100_000) * price;
}, 0);
if (maxEstimate > 1)
  throw new Error("Comparison exceeds its $1 conservative input estimate");
console.log(
  `Conservative input estimate: $${maxEstimate.toFixed(4)} maximum; no provider retries`,
);
const report: unknown[] = [];
for (const profile of profiles) {
  const started = performance.now();
  const values = records.map((record) =>
    embeddingInput(
      profile,
      "document",
      record.text,
      [record.title, record.section].filter(Boolean).join(" · "),
    ),
  );
  const vectors: number[][] = [];
  let tokens = 0;
  let requested = 0;
  // Cache by exact text + complete model recipe, allowing incremental reindexing.
  for (let offset = 0; offset < values.length; offset += 32) {
    const batch = values.slice(offset, offset + 32);
    const paths = batch.map((value) =>
      resolve(cache, embeddingCacheKey(profile, value) + ".json"),
    );
    const missing = batch.map((_, i) => i).filter((i) => !existsSync(paths[i]));
    if (missing.length) {
      const result = await embedSearchInputs(
        profile,
        missing.map((i) => batch[i]),
        AbortSignal.timeout(60_000),
      );
      tokens += result.tokens;
      appendFileSync(
        resolve(cache, "usage.jsonl"),
        JSON.stringify({
          model: profile.model,
          profile: profile.key,
          tokens: result.tokens,
          at: new Date().toISOString(),
        }) + "\n",
      );
      requested += missing.length;
      for (const [i, position] of missing.entries())
        writeFileSync(paths[position], JSON.stringify(result.embeddings[i]));
    }
    vectors.push(
      ...paths.map((path) =>
        unitVector(JSON.parse(readFileSync(path, "utf8")), profile.dimensions),
      ),
    );
    if (offset % 320 === 0)
      console.log(
        `${profile.key}: ${Math.min(offset + batch.length, values.length)}/${values.length} passages`,
      );
  }
  const bytes = Buffer.alloc(vectors.length * profile.dimensions * 4);
  for (const [row, vector] of vectors.entries())
    for (let i = 0; i < vector.length; i++)
      bytes.writeFloatLE(vector[i], (row * profile.dimensions + i) * 4);
  const matrix = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const cases: unknown[] = [];
  if (mode === "compare")
    for (const probe of SEARCH_PROBES) {
      const input = embeddingInput(profile, "query", probe.query);
      const file = resolve(cache, embeddingCacheKey(profile, input) + ".json");
      const start = performance.now();
      const queryCached = existsSync(file);
      if (!queryCached) {
        const result = await embedSearchInputs(
          profile,
          [input],
          AbortSignal.timeout(30_000),
        );
        tokens += result.tokens;
        appendFileSync(
          resolve(cache, "usage.jsonl"),
          JSON.stringify({
            model: profile.model,
            profile: profile.key,
            tokens: result.tokens,
            at: new Date().toISOString(),
          }) + "\n",
        );
        requested++;
        writeFileSync(file, JSON.stringify(result.embeddings[0]));
      }
      const query = unitVector(
        JSON.parse(readFileSync(file, "utf8")),
        profile.dimensions,
      );
      const dense = rankVectors(records, matrix, query, probe.query, 40);
      const text = lexical.search(probe.query, 40);
      const hybrid = fuseSearchResults(text, dense);
      const rank = (results: { path: string }[]) => {
        const at = results.findIndex((result) =>
          probe.expected.includes(result.path),
        );
        return at < 0 ? null : at + 1;
      };
      cases.push({
        ...probe,
        lexicalRank: rank(text),
        denseRank: rank(dense),
        hybridRank: rank(hybrid),
        top: hybrid.slice(0, 5).map((result) => result.path),
        queryMs: Math.round(performance.now() - start),
        queryCached,
      });
    }
  if (mode === "publish") {
    mkdirSync(resolve(root, "public/search-vectors"), { recursive: true });
    const sha256 = digest(bytes);
    const file = `${profile.key}-${sha256.slice(0, 12)}.bin`;
    writeFileSync(resolve(root, "public/search-vectors", file), bytes);
    const manifest: SearchEmbeddingManifest = {
      version: 1,
      selected: profile.key,
      catalogueSha256: catalogueDigest(catalogue),
      profiles: [{ profile, file, sha256, rows: records.length }],
    };
    writeFileSync(
      resolve(root, "src/search/embeddings/manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
  report.push({
    profile,
    catalogueSha256: catalogueDigest(catalogue),
    passages: records.length,
    requested,
    tokens,
    bytes: bytes.length,
    elapsedMs: Math.round(performance.now() - started),
    cases,
  });
}
writeFileSync(
  resolve(cache, `${mode}-report.json`),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    report.map((row) => {
      const { cases, ...summary } = row as { cases: unknown[] };
      return summary;
    }),
    null,
    2,
  ),
);
