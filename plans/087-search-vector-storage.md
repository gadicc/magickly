# Search vector storage — 18 November 2026

Status: designed, not built. Gadi settled decisions 1–3 and 6 on
18 November 2026 on the first measurements; the Fable 5.2 review the same
day ([below](#review-18-november-2026)) showed those measurements
overstated the history cost about sixfold. Gadi reconfirmed decision 1 on
the corrected numbers the same day and dropped the history rewrite
(decision 6); S0 is done. S1, the spike, is next. Read [plan 070](070-site-search.md) (the site
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

### S2. Publish, coverage and recipe

`search:publish` reads committed rows, then the worktree's private cache,
then the provider; writes new rows and prunes orphans. The shared recipe
and golden-key test, the coverage report and the zero-coverage rule
(decision 3). Tests for malformed rows. `src/search/README.md` and plan
070's contract updated.

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

