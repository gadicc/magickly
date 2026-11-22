import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTED_PAGES } from "../../src/search/adaptedPages";
import { VECTOR_ARTIFACT } from "../../src/search/embeddings/artifact";
import { EMBEDDING_PROFILES } from "../../src/search/embeddings/profiles";
import { assembleVectorArtifact } from "../../src/search/embeddings/rows";
import { PUBLIC_PAGES } from "../../src/seo/pages";
import { pageProse } from "./prose";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Writes only on change, so watchers and incremental builds stay quiet. */
function update(output: string, next: string | Buffer) {
  if (!existsSync(output) || !readFileSync(output).equals(Buffer.from(next)))
    writeFileSync(output, next);
}

// A page whose document an adapter builds has no extracted prose.
const prose = Object.fromEntries(
  Object.keys(PUBLIC_PAGES)
    .filter((path) => !ADAPTED_PAGES.has(path))
    .map((path) => [path, pageProse(root, path)]),
);
mkdirSync(resolve(root, "src/search/generated"), { recursive: true });
update(resolve(root, "src/search/generated/prose.json"), JSON.stringify(prose));
console.log(
  `search: extracted public JSX prose for ${Object.keys(prose).length} pages`,
);

// The selected profile's committed rows, assembled for /api/search (plan 087).
const { selected } = JSON.parse(
  readFileSync(resolve(root, "src/search/embeddings/manifest.json"), "utf8"),
) as { selected: string | null };
const artifact = resolve(root, VECTOR_ARTIFACT);
const profile = EMBEDDING_PROFILES.find((entry) => entry.key === selected);
if (!profile) {
  if (selected) throw new Error(`Unknown embedding profile: ${selected}`);
  rmSync(artifact, { force: true });
  console.log("search: no embedding profile selected");
} else {
  const { rows, bytes } = assembleVectorArtifact(root, profile);
  update(artifact, bytes);
  console.log(`search: assembled ${rows} embedding rows for ${profile.key}`);
}
