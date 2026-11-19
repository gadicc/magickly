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
