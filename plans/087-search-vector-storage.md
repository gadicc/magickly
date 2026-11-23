# Search vector storage — 18 November 2026

Status: designed, not built. Gadi settled decisions 1–3 and 6 on
18 November 2026 on the first measurements; the Fable 5.2 review the same
day ([below](#review-18-november-2026)) showed those measurements
overstated the history cost about sixfold. Gadi reconfirmed decision 1 on
the corrected numbers the same day and dropped the history rewrite
(decision 6); S0 is done. S1 is on `main` since 18 November
(below). S2 is built on `gate/search-vectors`, not yet on `main`; Gadi settled its
open questions on 23 November ([S2 decisions](#s2-decisions-23-november-2026),
[built](#built-23-november-2026-gatesearch-vectors)). Read [plan 070](070-site-search.md) (the site
search and its embedding contract) and `src/search/README.md` first. The
number was free on every local and remote branch on 18 November 2026.

## Background

Meaning search ships one float32 matrix, `public/search-vectors/
<profile>-<sha12>.bin`: 3,074 rows of 768 dimensions, 9.4 MB, named in
`src/search/embeddings/manifest.json` with its SHA-256 and the digest of
every catalogue record. `pnpm search:publish` writes a new matrix and
manifest; the per-passage cache in `.private/site-search` (ignored, per
worktree) means only changed passages are sent to the provider. If the
catalogue digest differs from the manifest, `store.ts` turns meaning search
off entirely and text search carries on ("a stale catalogue never uses old
vectors", `src/search/embeddings/store.ts:65`).

The cache saves provider calls, not repository space. Every publish commits
a whole new 9.4 MB blob under a new name, and because the gate is
all-or-nothing, nearly every commit that touches public prose republishes.

### Measurements (at `bf4db692`, 18 November 2026)

| What | Value |
| --- | --- |
| `.git/objects` in the main checkout | 118.6 MiB packed + 180.1 MiB loose (305 MB on disk) |
| Vector blobs reachable from any ref | 61; 18 of them loose, ~9.9 MB each |
| Packed vector blobs | 48 of 51 stored as deltas; 30.4 MB in all |
| A fresh full clone (`git clone --no-local --mirror`) | 76.4 MiB, of which vectors ~32 MB |
| Versions on `main` (9–17 November) | 57, one per publishing commit |
| Rows changed per publish | typically 1–20 of ~3,070; 95 at most after the first |
| Distinct rows across all 57 versions | 3,495, 10.7 MB |

Git does delta one matrix against the next once it packs them. The local
bloat is loose objects: each publish writes a 9.4 MB loose blob, which
float32 data keeps at full size, and `gc.auto` counts loose objects, not
their bytes, so dozens pile up before anything packs them. A scratch
repository replaying the 57 versions under one fixed name packed to 9.9 MiB
after `git gc --aggressive` and 26.5 MiB after a default
`git repack -a -d -f`, close to what the real history packs to now.

Merges republish too: three merge commits (`f0a70367`, `cb307dc5`,
`dba26695`) added no new rows but a new matrix, and two branches that both
publish conflict on the manifest.

## Decisions

Gadi settled decisions 1–3 and 6 on 18 November 2026, before the
corrected measurements, then reconfirmed decision 1 and replaced 6 after
them.
Decision 5 follows from 1; decision 4 is deferred by design.

### 1. One file per row, named by its input

Commit each row as its own file, named by the key the cache already uses,
`embeddingCacheKey(profile, preparedInput)`, in a top-level directory
outside `src/` (so the dev watchers and `search:build`'s inputs never see
it; name settled in S1):

```
search-vectors/gemini-embedding-2-768-search-v1/ab/ab12…ef.f32
```

3,072 bytes each (768 little-endian float32 values, already unit length),
fanned out by the first two hex characters, about 12 files per directory,
marked `*.f32 binary` in `.gitattributes`. `search:publish` writes the rows
the catalogue needs and prunes those it no longer references.
`search:build`, which every build, type check, test and dev task already
runs, assembles them into an ignored artifact under `src/search/generated/`
([decision 3](#3-the-manifest-shrinks-the-artifact-is-keyed)), which
`/api/search` traces instead of `public/search-vectors/*.bin`.

| | Today | Fixed filename | One file per row |
| --- | --- | --- | --- |
| Whole history so far, packed | ~32 MB | similar, 10–26 MB | ~11 MB |
| Each publish adds, packed | ~100 KB delta | ~100 KB delta | ~15 KB (the new rows) |
| Each publish adds, before gc | a 9.4 MB loose object | a 9.4 MB loose object | the new rows |
| Two branches publishing | conflict | conflict | merge cleanly |
| Cache on other checkouts | no | no | yes, for the shipped profile |

With corrected numbers the history saving is modest. What remains for
per-row files: no 9.4 MB loose object per publish, clean merges between
branches that both publish, the shipped profile's cache in every worktree,
and keys that make decision 2 natural.

The rows are public material already (plan 070), so moving them out of
`public/` withholds nothing; nothing in the browser fetches them.

### 2. Use every row that matches, instead of all or nothing

Because a row's name is the hash of its exact prepared input, a row can
only ever be used for the text it was made from. The catalogue-wide gate
becomes per record: records with a row rank by meaning and text, records
without one by text only. No stale vector is ever used, as before; meaning
search no longer goes dark between an edit and a publish, and a content
commit no longer has to republish.

Rows nothing references (orphans) are normal between a content commit and
the next publish: any edit re-keys its passage, a title change re-keys the
whole page, and two branches editing one page shift every later 180-word
window. So orphans are reported and pruned by `search:publish` (or an
offline prune task), never a test failure. Tests fail only on malformed
rows: wrong length, non-finite values, norm far from 1.

Coverage is reported, not enforced per commit: `search:build` prints how
many records have rows. Meaning search counts as unavailable when no
record is covered, so a profile change or a key drift cannot spend query
quota and a provider call on results that can only be text
(`src/search/http.ts:88-110`, `src/app/api/search/route.ts:8`). The
release build warns below 90% coverage.

### 3. The manifest shrinks; the artifact is keyed

`manifest.json` keeps the selected profile and drops the catalogue digest,
file name and matrix SHA-256. The integrity those gave moves here:

- **The assembled artifact is a sorted list of keys plus their matrix.**
  `store.ts` computes each record's key at load (measured: 38 ms for the
  catalogue, 10 ms for 3,074 keys) and looks rows up by key, never by
  position, so a stale artifact (`vitest` run directly, dev after a pull)
  can lower coverage but never pair a vector with the wrong record.
- **One recipe.** The prepared-input recipe lives only in
  `scripts/search/embed.mts:75-82` today, and line 60's estimate uses a
  different title. It moves into `records.ts` as one function that publish,
  build and store share, with a golden-key test, so publish and load cannot
  drift into zero coverage.
- `/search/index`'s `semanticAvailable` (`src/app/search/index/route.ts:13-15`)
  and `semantic.test.ts`'s fixed row (`src/search/semantic.test.ts:22-25`)
  move to the coverage rule.

Changing the profile (model, revision, prefixes, chunker) re-keys every
row, as today: one full re-embed and about 9.4 MB added once.

### 4. Smaller rows later, measured first (separate)

int8 rows (768 bytes) would quarter the working tree and the function
bundle. Not part of this plan: it changes ranking, so it waits for a
`search:compare` run on the plan 070 probes.

### 5. Not R2, Blob storage or Git LFS

The data is about 10 MB across its whole history once stored by row.
Object storage would make builds, tests and local development depend on
the network and a credential, stop a commit from fully describing its
deploy, and need a retention policy for old versions. Embedding during the
build would charge the provider on every deploy, which
`scripts/search/embed.mts` forbids on purpose. Git LFS would keep every
full version and need Vercel's LFS setting. Revisit only if the corpus
grows by one or two orders of magnitude.

### 6. No history rewrite

Settled first as: the storage change first, then a history rewrite once the
new format is stable and other worktrees can pause. On the corrected
numbers the rewrite would save about 32 MB per clone, not the 150 MB first
estimated, against the hazards [below](#what-the-rewrite-affects), so Gadi
dropped it. S0's `git gc` recovered most of the local space, and the format
change stops the loose-object growth. The rewrite stages stay here,
corrected, for reference.

## Stages

### S0. Pack what is loose (done, 18 November 2026)

`git gc` in the main checkout took `.git` from 316 MB to 97 MB (91.6 MiB
in two packs, no loose objects). It respects every worktree's HEAD, reflogs
and stashes. Until S3 lands, a `git gc` after a run of publishes keeps it
there.

### S1. Spike: build from rows

On a gate branch: slice the committed matrix at `bf4db692` into row files
by record order (its catalogue digest matches; the main checkout's
`.private/site-search` lacks 8 of the 3,074 rows and caches are per
worktree), assemble them in `search:build` into the keyed artifact, and
switch `store.ts` and the `/api/search` tracing to it. Acceptance: the
assembled matrix, read in catalogue order, hashes to `6f58ec17ab64…`, the
current manifest's SHA-256, which implies identical ranking with no provider
call.

#### Built (18 November 2026, `gate/search-vectors`)

Three commits on `c907203b` (the plan, on `main` at `afe7f7e1`):
`5e447eb2` adds the rows, `9023d77d` builds from them, and `a4c9f0da`
applies the review ([below](#s1-review)). Behaviour is unchanged: the same
vectors, ranking and all-or-nothing catalogue gate. They were first built
on `d7f3824e` as `010a50b9` and `8eb08b0a`; `main` then republished
([Rebased](#rebased-onto-afe7f7e1)), and the measurements below say which
tree they were taken on.

- **Rows.** `search-vectors/gemini-embedding-2-768-search-v1/<key[0:2]>/
  <key>.f32`, 3,076 files of 3,072 bytes, 256 fan-out directories;
  `.gitattributes` marks `*.f32 binary`. `src/search/embeddings/rows.ts`
  owns paths, validation (length, finite values, L2 norm within 10⁻³ of
  1), writing (only rows missing or different), pruning (with emptied
  fan-out directories), listing (anything but a correctly placed
  `<key>.f32` or a dot file is an error) and assembly.
- **One recipe.** `records.ts` has `embeddingDocumentInput(profile,
  record)` (the old `embed.mts:75-82`) and `embeddingRowKey`, over the
  unchanged `embeddingCacheKey`. `embed.mts` uses it for embedding and for
  its price estimate, which had used the title alone. A golden test in
  `embeddings.test.ts` pins two keys under the shipped profile.
- **Artifact.** `search:build` (`scripts/search/buildProse.ts`, after the
  prose) assembles the manifest's selected profile into
  `src/search/generated/search-vectors.bin`: one file, the magic `SVK1`, a
  length-prefixed JSON header `{ profile, dimensions, keys }` with keys
  strictly ascending, then the rows in key order (format in
  `artifact.ts`). It includes every row in the profile directory, orphans
  too; it is written only when its bytes change. Assembly costs 30–60 ms
  on top of the ~0.55 s prose extraction (a full `search:build` measured
  0.60 s against 0.56 s before). With no profile selected the artifact
  is removed. Every build, type check, test (including `test:coverage`,
  which CI shards run) and dev entry already runs `search:build`; and
  because `catalogue.ts` imports the generated `prose.json`, no build can
  succeed without it, so the artifact always exists where the catalogue
  does.
- **Store.** `store.ts` reads the artifact, computes each record's key and
  copies its row by key, never by position (`recordMatrix`,
  `artifactVectors`). The manifest's profile and catalogue digest checks
  stay; an artifact for another profile, or one lacking any record's row,
  returns null, as a digest mismatch does; the matrix rebuilt in record
  order must still hash to `manifest.profiles[…].sha256`, else it throws;
  the per-value finiteness check stays. Dropped: the check on the
  manifest's `.bin` file name, which `store.ts` no longer reads. A missing
  artifact still throws (`ENOENT`), as a missing `.bin` did.
- **Tracing.** `/api/search` traces
  `./src/search/generated/search-vectors.bin` instead of
  `public/search-vectors/*.bin`; that directory and its file stay until
  S3, and `semantic.test.ts` is unchanged.
- **Publish.** `search:publish` also calls `publishRows`: it writes the
  profile's rows from the matrix bytes it already builds, so the rows and
  the `.bin` are the same bytes, and prunes the rows no record uses. Not
  run (it calls the provider); covered by unit tests.
- **Tests.** `rows.test.ts` and `artifact.test.ts`: row validation,
  writing, listing, pruning, publishing, the assembly round trip, keyed
  lookup in any file order, null for another profile or a missing row, a
  checksum mismatch and a non-finite value under a matching checksum.

**Conversion.** A one-off script outside the repository (a scratch
directory under `/home`, deleted afterwards) checked that
`catalogueDigest(buildSearchCatalogue())` equals the manifest's
`catalogueSha256` (`5ffd4f69…`, it did) and that the committed
`public/search-vectors/gemini-embedding-2-768-search-v1-6f58ec17ab64.bin`
hashes to the manifest's `sha256`; then, for each record of
`embeddingRecords(catalogue)` in order, it took row *i* of that matrix
(bytes `i × 3072` to `(i + 1) × 3072`) and wrote it with `writeRows` under
`embeddingRowKey(profile, record)`. All 3,074 keys were distinct. As an
independent check of the recipe, a read-only pass over the main
checkout's `.private/site-search` found every one of the 3,074 keys there
(the cache has filled since `bf4db692`), each holding a vector that
encodes to byte-identical row bytes. The private cache was not used as a
source.

**Acceptance**, at `8eb08b0a` after its `pnpm build`: the artifact,
parsed and read in catalogue record order with `recordMatrix`, hashed with
SHA-256:

```
artifact rows 3074, records 3074, matrix bytes 9443328
sha256 6f58ec17ab64772b96258a8c475e2e4bb511b32bd94281974ae7b42e432b704b
```

equal to the manifest's `sha256`, so ranking is identical without a
provider call.

**Gates** (a script run with `bash`, each step's exit status recorded;
Node 24.18.0; the placeholder environment from `ci.yml`; a fresh
`pnpm install --frozen-lockfile` in each tree):

| Commit | install | check | typecheck | test | build |
| --- | --- | --- | --- | --- | --- |
| `010a50b9` (rows only, clean worktree) | 0 | 0 | 0 | 0 (661 files, 12,730 tests passed; 3 files, 18 tests skipped) | 0 |
| `8eb08b0a` | 0 | 0 | 0 | 0 (663 files, 12,747 tests passed; 3 files, 18 tests skipped) | 0 |

After the `8eb08b0a` build,
`.next/server/app/api/search/route.js.nft.json` lists
`../../../../../src/search/generated/search-vectors.bin` and no longer any
`public/search-vectors` file.

#### Rebased onto `afe7f7e1`

`main`'s `afe7f7e1` republished the vectors (3,076 rows,
`gemini-embedding-2-768-search-v1-ddf799a2b4e8.bin`, catalogue digest
`2060ab89…`). After rebasing, the conversion ran again on the rebased
tree, after `pnpm data:build` and `pnpm search:build`: it checked the
catalogue digest and the matrix's SHA-256 against the new manifest, then
called `publishRows` with the record keys and that matrix, which wrote 11
rows and pruned 9. The change was folded into the row commit.

**Acceptance** on the rebased tree: an independent script, outside the
repository, recomputing each key with the recipe as `main`'s `embed.mts`
writes it and reading the row files directly (not the artifact):

```
digest matches manifest: true
rows 3076 sha256 ddf799a2b4e86fd9e420df6a39718ffc620d7bae720fe963fc49dcdfd55d99e9 manifest ddf799a2b4e86fd9e420df6a39718ffc620d7bae720fe963fc49dcdfd55d99e9
```

The same script gave `6f58ec17…` for the 3,074 rows on `8eb08b0a`,
matching that manifest.

**Gate** at `b8600942`, whose tree is `9023d77d`'s plus the plan (same
script and environment as above):

| Commit | install | check | typecheck | test | build |
| --- | --- | --- | --- | --- | --- |
| `b8600942` | 0 | 0 | 0 | 0 (666 files, 12,784 tests passed; 3 files, 18 tests skipped) | 0 |

The `/api/search` trace lists only `src/search/generated/search-vectors.bin`.
`semantic.test.ts` loads the real index through `artifactVectors`, which
checks the record-order hash, so the passing test also proves every row
pairs with its record. `a4c9f0da` changes only `package.json` and
`embed.mts`; on it `pnpm check` and the scripts' `tsc` exit 0.

#### S1 review

An independent Opus 5.5 review (high) of the rebased diff found no critical
or high defects. It confirmed every row's bytes against the committed
matrix and, for 3,065 of the 3,076 keys, against the private cache, and
found the row listing and pruning safe against path traversal.

| Finding | Outcome |
| --- | --- |
| The S1 record and the row commit described the pre-rebase tree | This section and the row commit's message |
| `search:publish` wrote the manifest before the rows | Rows first (`a4c9f0da`) |
| `search:publish` left the artifact without the new rows | Rebuilds afterwards: `a4c9f0da` appended `&& pnpm search:build` to the task, which made pnpm hand the profile argument to that build instead of `embed.mts`, so every publish failed; the next commit moves the rebuild into `embed.mts` |
| `/search/index` stays digest-only while the store can be null for a missing row | S2 (decision 3) |
| An unknown profile or malformed row now stops `search:build`, and with it dev | Kept: it fails at build rather than in `/api/search`; S2 revisits for dev |
| No tests for `buildProse`'s branches or the publish call site | S2 |
| `semantic.test.ts`'s comment on what `/api/search` bundles | S3 deletes the test |

What S2 must also handle is listed under S2.

### S2. Publish, coverage and recipe

Already built, outside S2 (19 November 2026): `search:assemble` publishes
from committed rows alone, after a merge where two branches had each
published, and `search:publish` shares its last steps with it
(`src/search/embeddings/publish.ts`, which also deletes the profile's
earlier matrix). S2's lookup order can reuse `matrixFromRows`, which copies
row bytes as the first item below requires.

`search:publish` reads committed rows, then the worktree's private cache,
then the provider; writes new rows and prunes orphans (S1 already writes
and prunes). The coverage report and the zero-coverage rule (decision 3);
the shared recipe, golden-key test and malformed-row tests landed in S1.
`src/search/README.md` and plan 070's contract updated. Also, found in S1:

- A committed row reused as cache must be copied as bytes. Running it back
  through `unitVector` and re-encoding can move the last bit of a float32
  and stop the assembled matrix reproducing its published bytes.
- The artifact includes orphan rows, so the function bundle carries them
  until a publish prunes them. Once `search:build` computes coverage it
  has the catalogue's keys and can assemble only the referenced rows.
- The dev watcher (`scripts/search/watch.mts`) reacts only to `.js`/`.ts`
  changes under `src/`, so a pull that adds rows or changes the manifest
  reaches a running dev server only on the next source save. Decide
  whether that is acceptable or whether the watcher should also watch the
  selected profile's directory (257 directories, not the whole tree).
- A missing artifact throws today. With per-record coverage, decide
  whether it counts as zero coverage (unavailable) or stays an error; it
  can only be missing when `search:build` did not run, which also leaves
  `prose.json` missing and fails the build.
- `pruneRows` touches only the published profile's directory. Decide
  whether any other profile (the comparison's Qwen) may keep committed
  rows; `search:compare` writes none today.
- Any field added to `EmbeddingProfile`, even an optional one (such as
  decision 4's int8), changes `JSON.stringify(profile)` and so every key.
  The golden test catches it; such a change needs a new profile, not an
  edited one.
- `semantic.test.ts`'s "only the files the manifest names" test says
  `/api/search` bundles every file there, no longer true; S3 deletes it
  with the directory.

#### S2 decisions (23 November 2026)

Gadi took the recommendation on each of the questions above:

1. **Assemble only referenced rows.** `search:build` knows the
   catalogue's keys once it computes coverage, so the artifact and the
   function bundle carry only rows some record uses; orphans stay on disk
   until a publish or `search:assemble` prunes them.
2. **The dev watcher also watches the selected profile's row directory**
   and `src/search/embeddings/manifest.json`, so a pull that adds rows or
   changes the selection reaches a running dev server without a source
   save.
3. **A missing artifact stays an error.** It can only be missing when
   `search:build` did not run, and then `prose.json` is missing too.
4. **Only the shipped profile keeps committed rows.** `search:compare`
   writes none, and no other profile's directory is committed.
5. **A profile change is a new profile.** Adding or changing any field of
   `EmbeddingProfile` re-keys every row; the golden test catches it, and
   the change is made as a new entry with a new key, not an edit.

#### Built (23 November 2026, `gate/search-vectors`)

Five commits, first built on `14a3b4c3` (`main`'s `3fd4826c` plus the S2
decisions), then rebased onto `main`'s `37924292`
([below](#rebased-onto-37924292)). The measurements up to the rebase
section were taken before the rebase and name the commits as they were
then:

| Before the rebase | After | What |
| --- | --- | --- |
| `f26bc21a` | `09566109` | Per-record coverage: `search:build` assembles only referenced rows and reports coverage; the store and `/search/index` share one availability rule; tests |
| `28ea401c` | `28997e31` | `search:publish` and `search:compare` take each row from the committed rows, then the private cache, then the provider |
| `246acc5e` | `b0efa373` | The dev watcher also watches the selected profile's row directory and the manifest |
| `9502f9b2` | `d60a275d` | `src/search/README.md`'s contract; plan 070's dated note |
| `f17d8d0d` | `fb052382` | The store reloads when its artifact changes, so a dev server follows the watcher |

- **Coverage in `search:build`.** After the prose it imports the
  catalogue (only then, since the catalogue reads the `prose.json` just
  written), computes every record's key with `embeddingRowKey` and
  assembles only the rows some record references
  (`assembleVectorArtifact(root, profile, keys)` in `rows.ts`). Every row
  on disk is still validated, orphans too, so a malformed row fails the
  build; orphans are only counted. It prints, for example,
  `search: 3210/3210 records have embedding rows for
  gemini-embedding-2-768-search-v1; assembled 3210 rows, 0 orphan rows
  left on disk`, and below 90% a warning on stderr naming the share and
  `pnpm search:publish <profile>` (or, at zero, that meaning search is
  unavailable). The step is `scripts/search/vectors.ts`, so its branches
  are tested; `buildProse.ts` wraps it in a function because tsx runs that
  file as CommonJS, which has no top-level await.
- **Coverage for `/search/index`.** The artifact holds only referenced
  rows, so its header's keys are the coverage. `/search/index` reads the
  header alone (`readVectorArtifactHeader`, which also checks the file's
  size against it) and applies the store's rule to the current catalogue;
  no separate coverage file.
- **Store.** `coveredVectors` looks each record's row up by key
  (`artifactCoverage`) and returns the covered records and their vectors,
  built in one loop so a record and its vector cannot misalign;
  `rankVectors` then scores only those, and `fuseSearchResults` merges
  them with the lexical engine, which still indexes the whole catalogue.
  Null (unavailable) when nothing is covered or the artifact is for
  another profile. Removed from availability: the catalogue digest, the
  `rows` count and the record-order matrix hash. Kept: the manifest's
  profile against `EMBEDDING_PROFILES` (`selectedProfile`), and row
  validation (length, finite values, norm) through `decodeRow`, moved to
  `rowBytes.ts` so `/api/search` does not import the row files' handling.
  A missing artifact throws (decision 3). The loaded index is cached per
  artifact mtime and size, so a rebuilt artifact is reloaded (`f17d8d0d`).
- **One availability rule.** `/api/search`'s `available()` is
  `Boolean(await loadSemanticIndex())`; `/search/index`'s
  `semanticAvailable` is `semanticAvailable(catalogue)` in `store.ts`; both
  are "the selected profile, at least one covered record", from
  `artifactCoverage`. `http.ts` checks `available()` before reserving
  quota, so an uncovered index spends neither quota nor a provider call.
- **Publish lookup order.** `rowSources` and `gatherMatrix`
  (`publish.ts`): committed rows first, their bytes copied; then
  `.private/site-search`; then the provider, in batches of 32, for the
  rest. `embed.mts` works out the sources before the price check, so the
  estimate counts only provider rows (plus the fixed allowance for query
  probes). `search:compare` uses the same order, so it too no longer pays
  for committed rows. `search:assemble` is unchanged and ran on this tree
  without changing a file. Neither paid task was run.
- **Watcher.** `watch.mts` reruns `search:build` for `.js`/`.ts` changes
  under `src/`, for `src/search/embeddings/manifest.json`, and for any
  change in `search-vectors/<selected profile>/` (recursively, that
  directory only; until it exists, `search-vectors/` for it to appear; a
  manifest change re-arms it). Checked with the watcher alone: a dot file
  added and removed in a fan-out directory and a touched manifest each
  rebuilt once; a touched `prose.json` did not.
- **Tests.** `rows.test.ts`: referenced rows only, orphans counted and
  not a failure, a malformed orphan (length, NaN, norm) a failure.
  `artifact.test.ts`: coverage by key in any order, partial and
  other-profile coverage, the header-only read, full and partial
  `coveredVectors` with each covered record's own vector ranking its own
  page and the uncovered one never ranking, zero coverage, bad rows.
  `availability.test.ts`: both routes against full, half, empty and
  other-profile artifacts derived from the real one (available ⇔ 200;
  otherwise 503 with no quota or provider call), a missing artifact as an
  error, and the reload. `publish.test.ts`: the lookup order, an
  off-unit committed row copied rather than renormalised, batching, a
  wrong-sized reply. `scripts/search/vectors.test.ts`: no profile (the
  artifact removed, the catalogue never built), an unknown profile, a
  malformed row, full coverage, orphans with the 90% warning, zero.
  `manifest.test.ts` no longer compares the catalogue digest; it checks
  the selected profile and that `search-vectors/` holds only its directory
  (decision 4). `semantic.test.ts` picks a covered record (the planetary
  hours summary while it has a row) and checks the two routes agree.
- **Docs.** `src/search/README.md` describes the contract; plan 070 has a
  dated note. `semantic.test.ts`'s comment now says the service worker,
  not `/api/search`, takes every file in `public/search-vectors`; S3
  deletes the test with the directory.
- **Not changed:** `public/search-vectors`, the manifest's fields, the
  matrix `search:publish` and `search:assemble` write, and the
  `/api/search` tracing entry (S3).

**`search:build` time** (wall clock; the watcher runs the script directly;
Node 24.18.0, warm): before, at `14a3b4c3`, 0.56–0.66 s direct and
1.20–1.48 s through `pnpm search:build`; after, 1.01–1.11 s direct on the
uncommitted S2 tree, and 0.75–0.86 s direct and 1.36–1.42 s through pnpm at
`f17d8d0d` after the gate's fresh install. The added 0.2–0.45 s is mostly
importing the catalogue's modules under tsx (~0.4 s measured alone);
building the catalogue takes ~60 ms and the 3,210 keys ~15 ms.

**Acceptance, full coverage**, at `f17d8d0d` after its gate build (the
same output on the uncommitted tree before the commits): a script outside
the repository loading `loadSemanticIndex()` and hashing its `vectors`:

```
covered 3210/3210, record order: true, matrix bytes 9861120
store sha256    a713523516b52c3da71826154a51467b38cef11ef44295893d2ec3472e3dbdd9
manifest sha256 a713523516b52c3da71826154a51467b38cef11ef44295893d2ec3472e3dbdd9
```

So with every record covered the store's matrix is the published one and
ranking is unchanged.

**Acceptance, partial coverage**, on the uncommitted tree that became
`f26bc21a`–`9502f9b2`, then reverted: one word added to the Moon page's
prose (`src/app/astrology/moon/MoonText.tsx`). `pnpm search:build`:

```
search: 3208/3210 records have embedding rows for gemini-embedding-2-768-search-v1; assembled 3208 rows, 2 orphan rows left on disk
```

A direct store load:

```
available: true, /search/index rule: true
covered 3208/3210; uncovered: /astrology/moon#prose:0, /astrology/moon#prose:156
self-match to own page: 3208/3208
dense top for a covered /astrology/moon row: /astrology/moon, /open-source/components/moon-widget, /astrology/planets
lexical still finds the edited page: /astrology/moon
```

`pnpm test` on that tree exited 0: 736 files and 14,281 tests passed,
3 files and 19 tests skipped. After the revert `search:build` reported
3210/3210 again.

**Gate** at `f17d8d0d`, from a script run with `bash`, each step's exit
status recorded: Node 24.18.0; `rm -rf node_modules .next` and a fresh
`pnpm install --frozen-lockfile`; `pnpm build` with the placeholder
environment from `ci.yml`. The tasks ran as `package.json` records them,
so `test` and `build` went through `loom slots run`.

| Commit | install | check | typecheck | test | build |
| --- | --- | --- | --- | --- | --- |
| `f17d8d0d` | 0 | 0 (28 warnings, none in changed files) | 0 | 0 (736 files, 14,282 tests passed; 3 files, 19 tests skipped) | 0 |

After the build, `.next/server/app/api/search/route.js.nft.json` lists
`../../../../../src/search/generated/search-vectors.bin` and no row file,
and the prerendered `/search/index` body has `"semanticAvailable":true`.
The intermediate commits each passed `pnpm check`, `tsc --noEmit` and the
search tests (`src/search`, `scripts/search`) on their own tree.
`9502f9b2` is prose only.

#### Rebased onto `37924292`

`main` moved on while S2 was built. Its `0f20f618` ("fix(search): Index the
public rituals by metadata") skips the `/doc/*` ritual pages' prose
(`UNEXTRACTED_PAGES` in `adaptedPages.ts`, used by `buildProse.ts` and
`catalogue.ts`), edited `src/search/README.md`'s content section, and
republished: three rows pruned, the matrix now
`gemini-embedding-2-768-search-v1-119768d57cf5.bin`. The rebase onto
`37924292` conflicted only in `buildProse.ts`, resolved as S2's version
with `main`'s `UNEXTRACTED_PAGES` filter and comment. The README merged
without conflict, keeping both edits. The S2 decisions commit became
`3ba12fda`.

**Coverage**, at every rebased commit after `pnpm data:build`:

```
search: extracted public JSX prose for 41 pages
search: 3207/3207 records have embedding rows for gemini-embedding-2-768-search-v1; assembled 3207 rows, 0 orphan rows left on disk
```

**Acceptance, full coverage**, at `fb052382` after its gate build, with
the same script as above against the new manifest:

```
covered 3207/3207, record order: true, matrix bytes 9851904
store sha256    119768d57cf5fa45708a3536507185dd272a3b961c8e5dfc3361f28e9982d456
manifest sha256 119768d57cf5fa45708a3536507185dd272a3b961c8e5dfc3361f28e9982d456 (gemini-embedding-2-768-search-v1-119768d57cf5.bin)
```

**Each commit on its own tree** (checked out in the worktree; `pnpm
data:build`, `pnpm search:build`, `pnpm check`, `next typegen` and
`tsc --noEmit`, then the search tests in `src/search` and
`scripts/search`):

| Commit | data:build | search:build | check | tsc | search tests |
| --- | --- | --- | --- | --- | --- |
| `09566109` | 0 | 0 | 0 | 0 | 0 (15 files, 85 tests) |
| `28997e31` | 0 | 0 | 0 | 0 | 0 (15 files, 88 tests) |
| `b0efa373` | 0 | 0 | 0 | 0 | 0 (15 files, 88 tests) |
| `d60a275d` | 0 | 0 | 0 | 0 | 0 (15 files, 88 tests) |
| `fb052382` | 0 | 0 | 0 | 0 | 0 (15 files, 89 tests) |

`pnpm check` reports 28 warnings on each, as it does on `main`'s
`37924292`.

**Gate** at `fb052382`, the same script and environment as before the
rebase (fresh `pnpm install --frozen-lockfile`; `test` and `build` through
`loom slots run`):

| Commit | install | check | typecheck | test | build |
| --- | --- | --- | --- | --- | --- |
| `fb052382` | 0 | 0 (28 warnings, as on `37924292`) | 0 | 0 (737 files, 14,291 tests passed; 3 files, 19 tests skipped) | 0 |

After the build the `/api/search` trace lists
`../../../../../src/search/generated/search-vectors.bin` and no row file,
and the prerendered `/search/index` body has `"semanticAvailable":true`.

**`search:build` time**, direct, warm, alternating the two commits in
one session so the machine's load is the same: `37924292` (S1's assembly
of every row) 0.48–0.58 s, `fb052382` 0.71–0.82 s. Through `pnpm
search:build` at `fb052382`: 1.14–1.32 s.

#### For S3

- `selectedProfile` checks the manifest's copy of the profile in
  `profiles[]`; when S3 drops `file`, `sha256`, `rows` and
  `catalogueSha256`, keep the profile object (or check another way).
  `publishMatrix` then stops writing the matrix, and `semantic.test.ts`'s
  file test goes.
- With the matrix gone nothing records a digest of the published vectors,
  so the full-coverage check above (the store's matrix hashing to the
  manifest) can no longer be made. Printing the assembled matrix's
  SHA-256 in `search:build` would keep a comparable number.
- `/search/index` reads the artifact while it is prerendered and has no
  tracing entry; fine while it stays `force-static`.
- `search:build` now imports the catalogue, so it needs `data:build`
  first, as every task already runs; a bare `pnpm search:build` or
  `search:watch` on a fresh checkout fails without it. The watcher does
  not rerun when `packages/magick-data` changes, though the catalogue
  reads it; coverage is then reported late, never wrong, since the store
  recomputes keys at load.

### S3. Remove `public/search-vectors`

The last commit of the format change deletes the old directory and its
tracing entry. History from here on grows by rows.

## History rewrite (dropped; kept for reference)

### What the rewrite affects

Checked on 18 November 2026:

- **npm provenance.** All ten releases so far, magick-data 0.1.0–0.2.1
  and magick-components 0.1.0-rc.0–0.3.1, attest commits from 12–16
  November. After the rewrite those SHAs are on no branch. Proposed: push the
  old `main` to a ref outside `refs/heads` and `refs/tags`, such as
  `refs/archive/pre-vector-rewrite`, so the attested commits still resolve
  on GitHub while ordinary clones never fetch them. Unverified: that GitHub
  accepts a push to that namespace.
- **Worktrees and branches.** 15 worktrees and 29 local and remote refs
  contain `4c49aec0`. Each must be committed, merged or deliberately
  abandoned first.
- **Stashes and other refs.** Five stashes, all from the old `master`;
  filter-repo refuses a repository with stashed changes. Also
  `refs/backup/*` (7) and `refs/codex/turn-diffs/*` (6), which keep old
  objects alive until removed.
- **SHAs in files.** Thirteen plans and
  `src/app/(public)/open-source/components/page.tsx` cite commits from the
  rewritten range. filter-repo rewrites abbreviated SHAs in commit messages,
  not in file contents; a follow-up commit maps them with filter-repo's
  `commit-map`.
- **GitHub.** The 37 `refs/pull/*` refs cannot be deleted by us and keep
  old objects alive there, as does the archive ref, so GitHub's reported size
  will not fall; only clones shrink. Open Dependabot pull requests on the old
  history are closed and reopened by Dependabot. The two remote branches,
  `codex/components-rc` and `codex/magickli-test-integration`, are rewritten
  and force-pushed, or deleted. The four public forks predate `4c49aec0`.
- **Vercel.** Old deployments keep working and point at old SHAs; the
  first push after the rewrite deploys as usual.
- **Old commits.** Checked out after the rewrite, they have a manifest but
  no matrix: meaning search is off and `semantic.test.ts` fails there.
- **Signing and protection.** No commit on `main` is signed and `main` has
  no branch protection.
- **Other clones.** Gadi knows of none beyond this machine (18 November
  2026). Any that turns up must be re-cloned and must not push its old
  history back.
- **Tooling.** `~/.local/bin/git-filter-repo` is broken (its pipx
  interpreter is gone): `pipx reinstall git-filter-repo` first.

### R0. Freeze and back up

No pushes from any session or worktree until R5. Stash branches first, so
the bundle carries them:

```bash
for i in 0 1 2 3 4; do git branch backup/stash-$i "stash@{$i}"; done
```
```bash
git clone --mirror git@github.com:gadicc/magickly.git ~/backups/magickly-$(date +%F).mirror.git
```
```bash
git bundle create ~/backups/magickli-local-$(date +%F).bundle --all && git bundle verify ~/backups/magickli-local-$(date +%F).bundle
```
```bash
git rev-parse main > ~/backups/magickli-old-main-$(date +%F).sha
```

Also archive the main checkout's `.git` directory and record
`git worktree list --porcelain` and `git for-each-ref` output.

### R1. Rehearsal on a mirror

`--no-local` gives filter-repo the freshly packed repository it insists on;
a local mirror hardlinks packs and loose objects and copies `refs/stash`:

```bash
git clone --no-local --mirror /home/dragon/www/projects/magickli ~/scratch/magickli-rewrite.git
```
```bash
cd ~/scratch/magickli-rewrite.git && git update-ref -d refs/stash && git filter-repo --analyze && git filter-repo --path public/search-vectors/ --invert-paths
```

Check: the packed size; that `main`'s tree is identical to the old `main`
apart from `public/search-vectors`; that every local branch and the stash
branches came through; that `filter-repo/commit-map` covers every rewritten
commit; and, with a throwaway ref, that GitHub accepts a push to
`refs/archive/*` and a default clone does not fetch it. Rehearse R4 on a
copy too.

### R2. Rewrite

Run R1's commands for real on a fresh mirror taken after the freeze.

### R3. Push

The archive ref from the R0 mirror, which still has the old objects (the
rewritten mirror has pruned them):

```bash
git -C ~/backups/magickly-<date>.mirror.git push git@github.com:gadicc/magickly.git <old-main-sha>:refs/archive/pre-vector-rewrite
```

Then, from the rewritten mirror, with a lease on each old SHA from R0:

```bash
git push --force-with-lease=main:<old-main-sha> git@github.com:gadicc/magickly.git main
```

and the same for each remote branch kept.

### R4. Local checkouts

Either re-clone and recreate the worktrees still needed, or fetch the
rewritten branches into the main repository and move each worktree onto its
rewritten branch (safe only because R0 left every worktree clean); R1
decides which. Then delete every old ref (`refs/backup/*`,
`refs/codex/turn-diffs/*`, `backup/stash-*`, remote-tracking refs), confirm
`git rev-list --all --objects | grep search-vectors` is empty, and only then
`git reflog expire --expire=now --all && git gc --prune=now`, once the
backups are confirmed readable.

### R5. Afterwards

- A commit mapping the cited SHAs in plans and the components page through
  `commit-map`.
- The freeze lifted.
- Keep the R0 backups until at least one release has gone out on the new
  history.

## Review (18 November 2026)

A Fable 5.2 review of this plan, read-only against `bf4db692`. Verified
here before changing the plan: 18 of 61 vector blobs loose and 48 of 51
packed ones deltas (30.4 MB); a fresh full mirror at 76.4 MiB; the
watcher reacting only to `.js`/`.ts` files under `src/`; plan 070, not
071, as the search plan; `/search/index` reading the catalogue digest.

| Finding | Change here |
| --- | --- |
| The history cost was overstated: git deltas packed matrices; the 199 MB was mostly loose blobs | Measurements, decision 1's table, decision 6 reopened, S0 |
| Failing tests on orphans contradicts decision 2 | Orphans reported and pruned, never a failure |
| A positional artifact and the dropped digests leave no integrity check | Keyed artifact, shared recipe, golden-key test |
| Zero coverage would still spend quota and a provider call | Unavailable at zero; `/search/index` and the test follow |
| S1's conversion source was the incomplete main-checkout cache | Slice the committed matrix; acceptance by its SHA-256 |
| Wrong plan cited | 070 throughout |
| R0, R1, R3 and R4 as written would fail or free nothing | Commands corrected |
| Rows under `src/` add inotify watches; CRLF/NUL bytes in rows | Top-level directory; `*.f32 binary` |

Checked and fine by the review: row bytes reproduce exactly from the cache
and across independent embeds on 11 and 17 November; 3,074 distinct keys;
Biome, `tsc` and vitest unaffected by `.f32` files; every build, test,
typecheck and dev entry runs `search:build`. Not checked: the Vercel
project's build command, whether GitHub accepts `refs/archive/*`.

