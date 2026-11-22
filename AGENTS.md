<!-- loom-managed:agents:start -->
## Loom
This repo consumes `@gadicc/loom`.

For all work in this repo:
1. Use the `loom` skill first.
2. Read `loom.json` before making Loom-related changes.
3. Treat active Loom features and configured paths as the contract between the app and the shared package.
4. Read `project.tooling` in `loom.json`; do not assume tasks live in `package.json` or that pnpm is the runner.
5. If the task touches a specific active Loom feature, also use the matching feature skill such as `loom-jobs`.
6. Next commands load `.env*` themselves; non-Next commands that need env should use the authoritative project task or `loom env -- <command>`, not inline env-loader imports.
7. Keep project-specific rules outside this managed block; shared Loom policy lives in the `loom` skill.
8. For code and design reviews, use `loom-torvalds-review` before `linus-torvalds-skill`; its context profiles and precedence rules override literal kernel guidance.
<!-- loom-managed:agents:end -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentation screenshots

Help pages with screenshots (today `src/app/help/temples`) get their images
from `scripts/docs-screenshots`, never by hand. When you change a page that
shows them, or a screen they show (temples, the ritual list or creation form,
the ritual editor, the reader), regenerate the images and commit them with the
change. Read `scripts/docs-screenshots/README.md` first: it covers running the
seed and capture, adding a shot, and the rule that images contain only
synthetic data (no real temple, member or email; ritual titles are fine).
From a worktree, capture with
`/usr/local/bin/magickli-docs-capture <worktree> <shot>...` (the README's
"Capturing from a worktree"; it takes a few minutes, so use a long timeout);
if it is not installed, ask the owner rather than starting a dev server with
the main checkout's `.env.local`.

## Outside sources

Cite outside material by a stable reference rather than committing a copy:
an archive.org item ID with its page or leaf, a Wikimedia Commons file page,
a URL pinned to a commit, or a DOI, plus a SHA-256 when we depend on the
exact bytes (as `assets/fonts/README.md` does). Put the citation next to
what it supports: the plan, the data file or the preset. Commit a
public-domain file only when it is small and the app needs it, with the
basis for its status recorded; being on archive.org does not make a work
public domain. One exception (plan 072): data the app serves that is
generated from an openly licensed source (CC BY, such as
`src/geo/server/places.tsv` from GeoNames, or a permissive notice, such
as SCOWL's for the gap hints' `src/app/enochian/translate/hints/table.json`
in plan 081) may be committed when a committed script rebuilds it from a
hash-pinned copy of the source, and a README beside it gives the source,
the licence (with its notice in full where the licence asks for one) and
what we changed. The script checks the SHA-256 before it uses the copy,
and the README says where that exact file can be had: an archived copy
where one exists, otherwise the project's own versioned release URL.
Copyrighted sources (such
as the Llewellyn editions of Regardie's *The Golden Dawn*) never enter
the repository, not even as crops or extracted images; only facts taken
from them, such as a temple layout, drawn with our own art. Material from
private temples stays out of the repository altogether.

Israel Regardie's *The Golden Dawn* (Aries Press, Chicago, 1937–40),
which much of the site draws on: vol. 1 was renewed and is in US
copyright to the end of 2032; vols. 2–4 were never renewed and are public
domain in the US; all four are in copyright to the end of 2055 where
copyright runs for life plus 70 years (Regardie died in 1985). The site is
read worldwide, so treat every volume as in copyright: take facts, link
its archive.org pages, and quote, mirror or trace nothing. Plan 091 has
the records and what is still open.

## Reference work: show the evidence

magick.ly is a reference. A reader should be able to check any fact we
give against the original, see where sources disagree, and understand
why. So, for facts taken from books and manuscripts:

1. **Read more than one witness.** Prefer the earliest printing or
   manuscript you can reach, and use later editions, reprints, copies and
   the author's own sources as further witnesses. A reprint may be reset
   (the reissue of Lenain recorded as 1909 was, with new errors and silent
   corrections), so check before treating it as a facsimile.
2. **Say whose a discrepancy is.** Where witnesses differ, record what
   each one reads, with its page or leaf, and say whose slip or change it
   is when the evidence shows it (author, printer, a later edition, a
   copyist, our own reading); where it cannot be settled, say so and what
   would settle it. Check readings against independent derivations where
   they exist (the 72 names against Exodus 14:19–21; a table against the
   text it summarises), and record known exceptions explicitly, so a new
   one fails the build.
3. **Our own research counts as evidence, and is labelled.** Machine
   readings, hand readings and comparisons are recorded with who or what
   made them and how, and a reader not told the expected value is better
   than one who is. Keep the data that verdicts rest on in committed
   files, so the apparatus is rebuilt from the repository, not from a
   chat.
4. **Link the page, not just the book.** Every reading a note relies on
   links the exact page or leaf of a scan (archive.org `/page/n<leaf>`,
   Google Books `&pg=PA<n>`, Gallica `/f<n>`), and the pages listing an
   edition's sources describe each one: what it is, whose copy, and what
   it is used for.
5. **Mirror what readers most need, within budget.** Public-domain pages
   that a page leans on heavily (a plate, a table, a source's cited page)
   may be mirrored in `public/sources/` and opened in the lightbox
   (`src/sources/`, `pnpm sources:mirror`, with `--originals` for pages a
   script cannot fetch, such as Google Books'), with the region outlined
   and the basis for its public-domain status in `public/sources/README.md`.
   The mirror's total is pinned by `src/sources/mirroredPages.test.ts`;
   raise the cap only deliberately, say why in the plan, and when the
   mirror outgrows the repository move it to the app's file storage
   (plan 080) rather than raising it again. Everything else stays an
   outside link.

This sits beside "Outside sources" above, which governs what may enter the
repository at all.

## Layout: phones first, wide screens used well

Every page is built for a phone first and checked on a wide screen too.
Extra width is used for what helps the reader, never just for longer lines.

1. **Phones.** Every page works from 320 px: no sideways page scroll, a
   16 px side gutter, controls and links set apart as targets of their own
   (at least 44 px on a touch screen, `pointer: coarse`, and 24 px with a
   mouse, as the footer and the export buttons have them), and nothing that
   needs a hover to reach. A wide table or drawing scrolls or scales inside its
   own box, not the page.
2. **A reading column.** Running text (prose, prayers, rituals, quoted
   sources, a page's text below its tool) sits in a column of about 70
   characters a line: 32rem in the site's Roboto at 16 px, as the
   Oration's prayer has it (the owner's choice, 22 November 2026: reader
   comfort over width). Measured there, by counting the characters on
   rendered lines: 32rem holds about 69, 36rem about 78, 46rem about 101.
   A different font or size changes these, so measure a new column rather
   than assume it. The ritual reader's 46rem (plan 089, decision 2) was
   set before this was measured; plan 094 asks whether it narrows.
   Prose starts at the left (right in Hebrew). A set text read as a whole,
   such as a prayer, may be justified, with `hyphens: auto` (and
   `-webkit-hyphens` for Safari) and the page's `lang` set, so the browser
   can hyphenate instead of opening gaps on a phone.
3. **Extra width goes beside the column.** On a wide screen, put the
   things a reader looks at alongside the text there: the contents, the
   controls, notes, sources, a translation or other version, a drawing.
   Side rails start at about 1,200 px (15rem either side of the column, as
   the reader and the Oration have them); a tool or drawing may use the
   full width, while its explanation stays in the column.
4. **One page, arranged by CSS.** Each piece is rendered once and placed
   by the grid at each width. Never render it twice and hide one copy, or
   choose between copies in JavaScript, which breaks search, prerendering
   and screen readers. Use logical properties (`inline-start`), so Hebrew
   mirrors.
5. **Check it.** Before calling a page done, look at it in the browser at
   375, 768 and 1,440 px, in light and dark, and in Hebrew where the page
   has a Hebrew edition. Check for sideways scroll, line length, and where
   controls and notes land. A visual choice between options goes to the owner
   as a side-by-side mock-up at real sizes before it is built.

## Hebrew fonts

Hebrew that stands alone (single letters, names, short or large words) is
set in Frank Ruhl Libre; longer running Hebrew in Noto Sans Hebrew; Noto
Serif Hebrew is not used. Plan 079, decision 6, has the rule and where each
font lives.

## Interface and site-copy translations

When adding or changing interface text or site-authored public prose:

1. Mark complete messages for Lingui (`/*i18n*/` literals with `UiText`,
   `UiRichText`, or the scoped translator). Include labels, alt text and metadata.
   Keep whole sentences together and give interpolations meaningful names.
2. Run `pnpm i18n:extract`. Translate new/changed Hebrew entries and review
   existing fuzzy entries in `src/locales/he/messages.po`. The coding agent may
   translate the delta directly; `pnpm i18n:translate` previews the delta without
   calling a provider. `pnpm i18n:update` uses the explicitly configured
   `I18N_TRANSLATION_MODEL` through Vercel AI Gateway. Never invent credentials or
   send stored rituals, private content or outside source texts to this task.
3. Run `pnpm i18n:check` and relevant tests. Commit reviewable PO sources with
   the code. Generated catalogs remain ignored. Builds/CI never invoke AI.
4. Reuse public page components across languages. Keep external source titles,
   quotations, language-specific source data and stored rituals distinct from
   interface translation. Add each genuinely translated public route to the
   available-edition registry; do not create translated aliases for private/API
   routes. Preserve English search extraction through the explicit presentation
   adapter, without evaluating modules or following private imports.

Hebrew SEO launch is intentionally deferred. Keep `LOCALIZED_SEO_ENABLED` false:
localized routes stay usable but `noindex`, absent from sitemap/hreflang. Do not
flip this during routine copy work. The final launch checklist lives in
`src/i18n/README.md`.

## Site search embeddings

Search reads a page's literal JSX children and never props
(`scripts/search/prose.ts`), so pass prose to a layout component as children,
not as a prop (`notes={…}`, `drawing={…}`): text in a prop drops out of the
index without a failing test. `ToolLayout`'s slots and the Oration's notes
are children for this reason.

A commit that adds or changes indexed public text (a new public page, prose on
an indexed page, a component entry) moves the search catalogue's digest, and
`src/search/embeddings/manifest.test.ts` and `src/search/semantic.test.ts`
fail until its embeddings are published. Publishing is a paid call to the AI
Gateway; resolving two branches' publishes is not (`pnpm search:assemble
gemini-embedding-2-768-search-v1` rebuilds from the committed rows alone).

To publish from a worktree (gate worktrees have no `.env*`, and a fresh one has
no embedding cache, so without the second step it re-embeds every passage;
`../magickli` is the main checkout from a worktree beside it, elsewhere use its
full path):

1. Use the repository's Node (`nvm use 24`).
2. Seed the cache from the main checkout, which is keyed by exact text and
   model recipe and so is safe to share:
   `mkdir -p .private && cp -rn ../magickli/.private/site-search .private/`
3. Pass only the gateway key, never the rest of `.env.local`:

   ```bash
   AI_GATEWAY_API_KEY="$(grep -m1 '^AI_GATEWAY_API_KEY=' ../magickli/.env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')" pnpm search:publish gemini-embedding-2-768-search-v1
   ```

   Never print, log or commit the key.
4. Copy the new cache entries back for the next worktree:
   `cp -rn .private/site-search/. ../magickli/.private/site-search/`
5. Commit the changed `search-vectors/` rows, the manifest and the new matrix
   with the change that needed them.

**Agents may run this without asking** when the run's conservative estimate
(the script prints it before any paid call, and refuses anything over $1) is
under $2, and the day's running total, including this run's estimate, stays
under $12. The total is kept in the shared ledger
`~/.local/state/magickli/search-publish.tsv`, one line a run, tab-separated:
local date (`date +%F`), the estimate in dollars, the tokens the run reports,
the worktree or branch. Add the line after every run, paid or not, and sum the
day's estimates before starting: if the day's total is $11 or more, or a run
would take it to $12 or more, ask the operator first. Any other paid
embedding work (a new profile, `search:compare`) is the operator's.
