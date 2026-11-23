# Site search

The shared app bar opens a lazy MUI dialog. `/search/index` distributes a
build-time public catalogue; its lexical engine runs in the browser and keeps
one public CacheStorage copy for later offline use. No queries leave the
browser while typing. “Search by meaning” (or Enter) explicitly requests a
hosted query embedding and fuses the server's lexical/dense page rankings.

## Content

`catalogue.ts` combines the public SEO registry, entity pages, Lenain divisions,
hall descriptions, public correspondence rows, angel entries in English and
French, the Enochian dictionary and Keys, and literal page prose.

`pnpm search:build` extracts literal visible JSX from public pages and their
directly used relative components. It never evaluates those modules or copies
arbitrary code/string constants/props. Expressions need explicit data adapters;
this is not a general React renderer. The development wrapper builds it before Next and watches source changes.
Builds, type checks and the full test task generate the ignored prose artifact before consuming it.

Page summaries and overlapping 180-word passages share stable ownership and
existing anchors where available. Results group by canonical page. Exact titles
and aliases retain priority when combining lexical and semantic results. Hebrew
niqqud and Latin accents are ignored for lexical matching; multilingual meaning
search uses the selected embedding model.

Only public sources enter the catalogue. Account pages, private temple records,
private ritual bodies and the separate chat PDF corpus are not searched. The
three public ritual landing pages have catalogue metadata, not newly extracted
copies of ritual texts, and no extracted prose: their JSX is the reader's own
interface (`INTERFACE_PAGES` in `adaptedPages.ts`), so rewording the reader
needs no republish. Adding private search requires permission-aware
retrieval and a separate storage/distribution contract.

## Embeddings

`embeddings/profiles.ts` records the model ID, our recipe revision, dimensions,
normalization, chunker and distinct query/document prefixes. Hosted APIs do not
expose immutable weight revisions; the recorded revision identifies our recipe,
not a claim that the provider's weights are pinned. Different model spaces are
never compared, including when dimensions happen to match.

The initial comparison is recorded in `plans/070-site-search-comparison.json`.
Gemini Embedding 2 at 768 dimensions is the initial selected profile. Qwen's
comparison cache remains separate. Only the selected profile ships; the
indexed public material and its vectors are public assets.

### Rows and coverage (plan 087)

Each catalogue record (a page summary or passage) is embedded from one
prepared input, `embeddingDocumentInput` in `embeddings/records.ts`, and its
vector is committed as one row file named by `embeddingRowKey`, a hash of the
complete profile and that exact input:
`search-vectors/<profile>/<first two hex>/<key>.f32`, 768 float32 values,
little-endian, unit length. Only the selected profile has committed rows.

`pnpm search:build` (run by every build, type check, test task and the dev
wrapper) builds the catalogue after the prose, computes every record's key
and assembles the rows some record references into the ignored artifact
`src/search/generated/search-vectors.bin` (format in `embeddings/artifact.ts`),
which `/api/search` traces. It prints how many records have a row and how
many rows nothing references (orphans), and warns below 90% coverage. Every
row on disk is validated: a wrong length, a non-finite value or a norm far
from 1 fails the build and the tests. Orphans are normal after a content
edit and fail nothing; a publish prunes them.

Coverage is per record. A record with a row ranks by meaning and text; a
record without one (its text changed since the last publish) is left out of
dense ranking only and is still found by text and fusion. Because a row is
keyed by its exact input, no stale vector is ever used, and a content commit
does not have to republish. Meaning search is unavailable only when no
record is covered (a profile or recipe change with no republish): then
`/api/search` answers 503 before spending quota or calling the provider,
and `/search/index` reports `semanticAvailable: false`. Both apply the same
rule (`embeddings/store.ts`); `/search/index` reads only the artifact's
header. A missing artifact is an error, not zero coverage: it means
`search:build` did not run. The store also checks the manifest's profile
against `embeddings/profiles.ts`. Changing any field of a profile re-keys
every row, so a changed recipe is a new profile, and `embeddings.test.ts`
pins two keys.

To refresh after changing content:

```sh
pnpm search:compare
pnpm search:publish gemini-embedding-2-768-search-v1
```

These are explicit provider tasks, never build hooks. They use `loom env` and
the same Gateway credential/OIDC convention as chat. Each takes every row it
needs from the committed rows first (their bytes copied as they are), then
the worktree's private cache under `.private/site-search` (keyed like the
rows), and calls the provider only for what is still missing. It verifies
current public model pricing against a conservative $1 input estimate for
those rows before provider work and disables provider retries. Cached query
probes can be reused as well. A publish writes the new rows, prunes orphans,
and still writes the matrix in `public/search-vectors` and its SHA-256 and
catalogue digest in `embeddings/manifest.json`, deleting the profile's
earlier matrix; nothing reads those for availability any more, and plan
087's S3 removes them. Review the rows and manifest with the content change.

When two branches have each published, a merge or rebase conflicts on the
manifest, and git may also report the two matrices as a rename/rename
conflict of the one they replaced. Every row either side needed is committed
under `search-vectors/`, so resolve the manifest to either side's valid JSON
(`search:build` parses it), keep both sides' row files (if both added the
same row, either file will do), stage any matrix, and run

```sh
pnpm search:assemble gemini-embedding-2-768-search-v1
```

It does what `search:publish` does with the vectors it reads from the
committed rows alone, copying their bytes: no provider, credentials or
network, so it costs nothing. It stops before writing anything if a record
has no committed row, naming the page; that text needs `search:publish`.
It deletes every other matrix of the profile, whichever you staged.

Builds never silently re-embed. The server scores the covered rows
exhaustively; no vector database or ANN index is needed. The browser does
not download this matrix or a model. In development the search watcher
reruns `search:build` when source files, `embeddings/manifest.json` or the
selected profile's row directory change, so a pull that adds rows reaches a
running server.

## HTTP and release

`POST /api/search` accepts one 2–300-character query in at most 4 KiB of JSON.
It rejects mismatched browser origins, reserves persistent capacity, embeds
once with cancellation and a 15-second signal, and returns public grouped
results with `no-store`. It logs no query text or provider error details.

Migration `0020_site_search_usage` adds the separate shared daily counter.
The initial allowance is 10,000 hosted queries per UTC day across all visitors;
it is a request allowance, not an account-level dollar spending cap. Text
search is unlimited and does not consume chat allowance. Missing quota storage,
provider failure and exhaustion leave local text search working.

Use the existing staged release workflow to apply the migration before
promoting the app. No deployment, production migration or provider setting is
part of preparing this branch.

`pnpm search:browser` checks an isolated local preview (default port 4187)
with the existing Chromium/CDP helper. `SEARCH_ORIGIN` must be loopback;
`SEARCH_SCREENSHOTS` selects its output directory. It tests lazy loading,
destination ranking, keyboard navigation, focus restoration and phone layout.
