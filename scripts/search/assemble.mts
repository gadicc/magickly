import { buildSearchCatalogue } from "../../src/search/catalogue";
import { EMBEDDING_PROFILES } from "../../src/search/embeddings/profiles";
import {
  matrixFromRows,
  missingRows,
  publishMatrix,
} from "../../src/search/embeddings/publish";
import {
  catalogueDigest,
  embeddingRecords,
  embeddingRowKey,
} from "../../src/search/embeddings/records";

// Publishes from committed rows alone: no provider, no credentials, no
// network. For a merge or rebase where two branches each ran search:publish
// (their manifests and matrices conflict, but every row each needed is
// committed), or a checkout without the private cache. A record with no
// committed row stops it, naming the page; that text needs search:publish.
const profile = EMBEDDING_PROFILES.find(
  (candidate) => candidate.key === process.argv[2],
);
if (!profile)
  throw new Error("Use search:assemble <profile-key>, as for search:publish");
const root = process.cwd();
const catalogue = await buildSearchCatalogue();
const records = embeddingRecords(catalogue);
const keys = records.map((record) => embeddingRowKey(profile, record));
const missing = missingRows(root, profile, keys);
if (missing.length) {
  for (const i of missing)
    console.error(`no committed row: ${records[i].path} (${records[i].title})`);
  throw new Error(
    `${missing.length} records have no committed row; run search:publish`,
  );
}
const published = publishMatrix(
  root,
  profile,
  catalogueDigest(catalogue),
  keys,
  matrixFromRows(root, profile, keys),
);
console.log(
  `${profile.key}: ${keys.length} rows from search-vectors, pruned ${published.pruned.length}; ` +
    `${published.file}, removed ${published.removed.join(", ") || "nothing"}`,
);
