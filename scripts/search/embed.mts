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
  type EmbeddingProfile,
  embeddingInput,
  unitVector,
} from "../../src/search/embeddings/profiles";
import { embedSearchInputs } from "../../src/search/embeddings/provider";
import {
  gatherMatrix,
  publishVectors,
  rowSources,
} from "../../src/search/embeddings/publish";
import {
  fuseSearchResults,
  rankVectors,
} from "../../src/search/embeddings/rank";
import {
  catalogueDigest,
  embeddingCacheKey,
  embeddingDocumentInput,
  embeddingRecords,
} from "../../src/search/embeddings/records";
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
const cached = (profile: EmbeddingProfile, value: string) =>
  resolve(cache, embeddingCacheKey(profile, value) + ".json");
// Each row from the committed rows first, then this worktree's cache, then
// the provider (publish.ts); only the provider's rows are estimated and paid.
const plans = profiles.map((profile) => {
  // The shared recipe (records.ts), so these keys are the rows store.ts finds.
  const values = records.map((record) =>
    embeddingDocumentInput(profile, record),
  );
  const keys = values.map((value) => embeddingCacheKey(profile, value));
  const sources = rowSources(root, profile, keys, (key) =>
    existsSync(resolve(cache, key + ".json")),
  );
  return { profile, values, keys, sources };
});
// Check live public pricing before any paid work; this task is deliberately small.
const listing = await fetch("https://ai-gateway.vercel.sh/v1/models", {
  signal: AbortSignal.timeout(20_000),
}).then((response) => response.json());
const maxEstimate = plans.reduce((total, { profile, values, sources }) => {
  const model = listing.data.find(
    (entry: { id: string }) => entry.id === profile.model,
  );
  const price = Number(model?.pricing?.input);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error("Cannot verify model price");
  const bytes = values.reduce(
    (sum, value, i) =>
      sources[i] === "provider" ? sum + Buffer.byteLength(value) + 256 : sum,
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
for (const { profile, values, keys, sources } of plans) {
  const started = performance.now();
  let tokens = 0;
  let requested = 0;
  const count = (source: string) =>
    sources.filter((entry) => entry === source).length;
  console.log(
    `${profile.key}: ${values.length} passages; ${count("committed")} committed rows, ` +
      `${count("cache")} cached, ${count("provider")} to embed`,
  );
  const bytes = await gatherMatrix(root, profile, keys, sources, {
    readCache: (key) =>
      JSON.parse(readFileSync(resolve(cache, key + ".json"), "utf8")),
    async embed(positions) {
      const result = await embedSearchInputs(
        profile,
        positions.map((i) => values[i]),
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
      requested += positions.length;
      for (const [j, i] of positions.entries())
        writeFileSync(
          cached(profile, values[i]),
          JSON.stringify(result.embeddings[j]),
        );
      return result.embeddings;
    },
  });
  const matrix = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const cases: unknown[] = [];
  if (mode === "compare")
    for (const probe of SEARCH_PROBES) {
      const input = embeddingInput(profile, "query", probe.query);
      const file = cached(profile, input);
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
    // Rows, manifest and artifact (publish.ts), shared with
    // search:assemble. The artifact is rebuilt there, not by a trailing
    // `&& pnpm search:build` in package.json, where pnpm would append the
    // profile argument to that last command instead of this script.
    const published = publishVectors(root, profile, keys, bytes);
    console.log(
      `${profile.key}: wrote ${published.written} rows, pruned ${published.pruned.length}; ` +
        `record-order sha256 ${published.sha256}`,
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
