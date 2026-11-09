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
copies of ritual texts. Adding private search requires permission-aware
retrieval and a separate storage/distribution contract.

## Embeddings

`embeddings/profiles.ts` records the model ID, our recipe revision, dimensions,
normalization, chunker and distinct query/document prefixes. Hosted APIs do not
expose immutable weight revisions; the recorded revision identifies our recipe,
not a claim that the provider's weights are pinned. Different model spaces are
never compared, including when dimensions happen to match.

The initial comparison is recorded in `plans/070-site-search-comparison.json`.
Gemini Embedding 2 at 768 dimensions is the initial selected profile. Qwen's
comparison cache remains separate. The published binary matrix uses float32
little-endian values, with an exact-byte SHA-256 and a digest of all catalogue
records in `embeddings/manifest.json`. Only the selected profile ships; the
indexed public material and its vectors are public assets.

To update after changing content:

```sh
pnpm search:compare
pnpm search:publish gemini-embedding-2-768-search-v1
```

These are explicit provider tasks, never build hooks. They use `loom env` and
the same Gateway credential/OIDC convention as chat. Each verifies current
public model pricing against a conservative $1 input estimate before provider
work and disables provider retries. A cache under `.private/site-search` is
keyed by the full profile and exact prepared input, so only changed passages
need new embeddings. Cached query probes can be reused as well. Review the
generated manifest and binary with changes to the public content.

Builds never silently re-embed. If the catalogue digest differs, semantic
search is unavailable and ordinary text search continues. The index loader
also validates the profile, binary size and checksum before any query call.
The server scores the small matrix exhaustively; no vector database or ANN
index is needed. The browser does not download this matrix or a model.

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
