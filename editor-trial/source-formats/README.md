# Source-format research

Research only. Nothing here is imported by the application. These are small
canonical projection trials, not production parsers or new saved formats.
They use the installed Pug lexer/parser and app semantic validator, and never
execute Pug expressions or render source as HTML.

Run from the project root with its supported Node 24 runtime:

```sh
pnpm exec node --import tsx --test editor-trial/source-formats/*check.mjs
pnpm exec node --import tsx editor-trial/source-formats/measure.mjs --examples
pnpm exec node --import tsx editor-trial/source-formats/measure.mjs <private-corpus-path>
```

The last command accepts the existing `magickli-private-ritual-corpus-v1` export,
checks its hashes, and prints aggregate counts only. Never redirect private
sources or parser errors into public research artifacts. The checked-in samples
come only from `fixture.mjs`, which is synthetic.
The compact sample intentionally retains two trailing spaces in text lines;
they separate inline words and must not be stripped from this exact projection.

## Candidates

- **Current Ritual Text:** the actual app codec, as the baseline.
- **Bounded semantic Pug:** explicit `nodeId` attributes, literal JSON attribute
  values, `say`/`do` aliases, mixed inline interpolation, `/` for absent children,
  and reserved literal/legacy wrappers. Empty generated interpolation text is
  omitted; authored empty text uses `ritualText(value="")/`. Consecutive pipe
  lines in Pug insert newline nodes, so the printer avoids them. This is a
  defined Pug subset, not a replacement for the unchanged legacy compiler.
- **Compact Ritual Text:** speech/action shortcuts, ordinary literal text,
  single-line simple block content, and existing exact tree/JSON fallbacks.
  It desugars to the proven app parser. Mixed inline content still expands into
  separate nodes; adding a compact inline grammar remains design work.
- **Directive tree:** explicit nested `:::` blocks with exact text/JSON fallbacks.
  It tests structural verbosity. It is **not a CommonMark implementation** and
  does not settle how Markdown paragraphs, emphasis, images or IDs would map.
  `markdown-check.mjs` separately characterizes the installed real Markdown
  parser on synthetic ritual shortcuts, metadata and ordinary rich text.

All measurements retain identical full UUIDs and exact semantic trees, including
absent versus empty children and adjacent text nodes. The original historical
Pug bytes are context only: they have no IDs and are not an equivalent canonical
projection. Sizes are properties of these printers, not lower bounds for the
formats or evidence of editor performance.

The prototypes intentionally omit production error UX, incremental parsing,
resource limits, formatting/comment retention, source selection mapping, draft
format migration, source-mode switching and mobile input. Do not wire them into
production without that work and an independently reviewed format contract.

See [the evaluation](../../plans/040-ritual-source-and-rendering-research.md).
