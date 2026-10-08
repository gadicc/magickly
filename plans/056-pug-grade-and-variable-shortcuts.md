# Pug grade and variable shortcuts — 8 October 2026

Gadi chose options 1 and 2 of the proposal in
[plan 055](055-ritual-editor-followups.md#proposal-grade-and-variable-shortcuts-in-source).

## Decisions

**Shortcuts.** In Pug text (pipe lines, text after a tag or a `Label:`
shortcut, and text inside `#[…]`), `0=0#ID` is a grade and `${name#ID}` a
variable, with the canonical semantic shapes the corpus uses (`grade` with
`{grade}`, `var` with `{name}`, both with empty children). Authors may type
`0=0` or `${name}` without an ID, as in the previous Pug editor; those get a
fresh ID, and the next reprint shows it. Grades take one or two digits each
side and need a non-word, non-`=` character (or a text boundary) on both sides.
Variable names are `[A-Za-z0-9_=]+`.

The conversion runs on Pug's Text nodes after parsing, so attribute values,
comments and `ritualText(value=…)` wrappers are never reinterpreted. The
printer uses a shortcut only for a canonical node whose surroundings cannot
change how it parses back (no word or `=` character just before a grade, no ID
character just after), and wraps literal text that would read as a shortcut.
Printed IDs fold like other IDs. parse(print(doc)) stays exactly doc (plan 053).

A grade needs a boundary on each side other than a word character, `=` or
`.`, so `3.1=2` stays text. A grade written with an ID keeps it whatever
follows (`0=0#ID.` is the grade and a full stop); a bare grade may not be
followed by `#`, so a malformed ID stays literal text. Text in `.` blocks and raw-HTML text are Pug Text
too and convert the same way. Literal look-alikes are written with
`ritualText(value=…)`, which the printer does automatically.

Because a shortcut can combine with neighbouring literal text into a
different node (`${` + `0=0#ID` + `}` reads as a variable), the printer
re-parses every run of literal text and shortcuts exactly as the parser will
and prints that run's shortcuts as tags whenever the result differs. Exactness
therefore holds by construction rather than by boundary rules alone.

Risk accepted: a Pug buffer typed before this change that holds `0=0` or
`${name}` as literal text now parses them as a grade or variable. Server
revisions are semantic JSON or legacy Pug (which already had these shortcuts),
so only unsaved local buffers can be affected. A clean pre-change draft whose
buffer contains such text no longer matches its document and goes to the
existing manual-recovery path, which keeps it downloadable; drafts without it
recover normally, empty text included.

**Empty text.** The legacy import keeps empty text nodes at interpolation
boundaries (144 of 3,053 text nodes in the bundled rituals). They render
nothing. The editor drops them from the document it loads, after the import
report's exact reader-tree check, so they disappear on the next save and are
never written back. Draft recovery compares and restores without them too. A
pending request retained from before the change is immutable and may write
them once; the next save drops them. The function lives in
`semanticNormalize.ts`, not `semantic.ts`, whose bytes are part of the reviewed
semantic compiler identity. A render test proves the reader output differs
only by one empty span per dropped node across the corpus. Wrappers in the
corpus drop from 214 to 74 from this alone.

## Commits

| Commit | Change |
| --- | --- |
| `e5bfae8` | This plan |
| `550c8f3` | Drop empty text nodes from loaded rituals |
| `08f7699` | Grade and variable shortcuts |
| `e0c6d62` | Independent review fixes |
| `cc093b9` | Final review fixes |
| (this commit) | Verification record |

## Verification

Every commit passed `pnpm check`, `typecheck`, `test:coverage` (per-file
thresholds met) and the webpack `build` in a separate worktree with one fresh
frozen install and CI's placeholder environment; the tip also passed
`loom init`, both `loom check`s, the `magick-data` smoke test and
`check:turbopack`, leaving the tree clean. `semantic.ts`,
`semanticCompilerImpl.ts` and `semanticCompile.ts` are unchanged.

Exactness: the suite enumerates every text of up to two characters from a
significant alphabet around a grade and a variable (24,642 documents) beside
the seeded random test, the corpus and the boundary cases. Outside the suite,
120,000 random documents, the independent reviewer's two exhaustive
enumerations (829,472 cases each) and the final reviewer's 1,335,368-document
fuzz all round-trip and print idempotently with every element ID folded. The
corpus prints 7, 20 and 13 grade and 22, 5 and 4 variable shortcuts with one
tag fallback; normalized, the Neophyte needs 21 wrappers instead of 77.

Reader output: rendering all three rituals with the real block renderer,
before and after dropping empty text, differs only by one empty span per
dropped node.

In a headless Chromium against the branch's dev server, the seeded Neophyte
fixture opens clean ("Saved", no warnings), its source shows
`${orderName#…}` and `0=0#…` with folded IDs, and no empty-text wrappers
remain.

Reviews: an independent fresh-context Opus 5.5 review found a grade between
literal `${` and `}` reading back as a variable, `.`-bounded grades, old-draft
recovery with empty text and shortcut diagnostic positions, fixed in
`e0c6d62` (the printer now re-parses each run). The final adversarial Fable
5.1 review found no round-trip failure; it found a grade losing its ID when
punctuation follows, spurious follow-ups for pre-change pending requests and
an uncounted node bound, fixed in `cc093b9`. Not changed: a shortcut ID after a
same-line `\#[` escape is not folded, and its diagnostic column is one off,
because Pug drops the backslash; the printer never writes that form.
