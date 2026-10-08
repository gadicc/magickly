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

Risk accepted: a Pug buffer typed before this change that holds `0=0` or
`${name}` as literal text now parses them as a grade or variable. Server
revisions are semantic JSON or legacy Pug (which already had these shortcuts),
so only unsaved local buffers can be affected.

**Empty text.** The legacy import keeps empty text nodes at interpolation
boundaries (144 of 3,053 text nodes in the bundled rituals). They render
nothing. The editor drops them from the document it loads, after the import
report's exact reader-tree check, so they disappear on the next save and are
never written back. A render test proves the reader's HTML is unchanged across
the corpus. Wrappers in the corpus drop from 214 to 74 from this alone.

## Verification

To be completed.
