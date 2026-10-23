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

# This is NOT the Next.js you know

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
public domain. Copyrighted sources (such as the Llewellyn editions of
Regardie's *The Golden Dawn*) never enter the repository, not even as crops
or extracted images; only facts taken from them, such as a temple layout,
drawn with our own art. Material from private temples stays out of the
repository altogether.
