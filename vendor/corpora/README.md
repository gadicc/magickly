# corpora (vendored)

`tarot-deck` depends on `corpora` through a GitHub URL and reads one file from
it, `data/divination/tarot_interpretations.json`. pnpm 11 refuses dependencies
of dependencies that come from a URL (`blockExoticSubdeps`), so that file is
kept here and `pnpm-workspace.yaml` points `corpora` at this directory.

- Source: <https://github.com/dariusk/corpora>, commit
  `ff1941630dc5a7aa3d4459fc038cb7a04ec93cb0` (the commit magickli already
  pinned).
- `data/divination/tarot_interpretations.json` is byte-identical to that
  commit's copy: SHA-256
  `5215d9a4cee41a07344b5eface5699fb6e78fbd325e63e161217659867c10757`.
- Licence: CC0, as the corpora README states.

Do not reformat the JSON file; it should stay identical to the source.
