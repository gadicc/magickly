import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UNEXTRACTED_PAGES } from "../../src/search/adaptedPages";
import { PUBLIC_PAGES } from "../../src/seo/pages";
import { pageProse } from "./prose";
import { buildVectorArtifact, update, vectorBuildReport } from "./vectors";

const root = fileURLToPath(new URL("../../", import.meta.url));

// A page whose document an adapter builds, or that is an app's interface
// around stored content, has no extracted prose.
const prose = Object.fromEntries(
  Object.keys(PUBLIC_PAGES)
    .filter((path) => !UNEXTRACTED_PAGES.has(path))
    .map((path) => [path, pageProse(root, path)]),
);
mkdirSync(resolve(root, "src/search/generated"), { recursive: true });
update(resolve(root, "src/search/generated/prose.json"), JSON.stringify(prose));
console.log(
  `search: extracted public JSX prose for ${Object.keys(prose).length} pages`,
);

// The selected profile's committed rows that the catalogue references,
// assembled for /api/search, with their coverage (plan 087). A function,
// since this file is CommonJS under tsx, which has no top-level await.
async function buildVectors() {
  const { selected } = JSON.parse(
    readFileSync(resolve(root, "src/search/embeddings/manifest.json"), "utf8"),
  ) as { selected: string | null };
  const { log, warn } = vectorBuildReport(
    await buildVectorArtifact(root, selected, async () => {
      // Imported only now: the catalogue reads the prose.json written above.
      const { buildSearchCatalogue } = await import(
        "../../src/search/catalogue"
      );
      const { embeddingRecords } = await import(
        "../../src/search/embeddings/records"
      );
      return embeddingRecords(await buildSearchCatalogue());
    }),
  );
  for (const line of log) console.log(line);
  for (const line of warn) console.warn(line);
}
buildVectors().catch((error) => {
  console.error(error);
  process.exit(1);
});
