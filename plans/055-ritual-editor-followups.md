# Ritual editor follow-ups — 8 October 2026

Follow-ups to the [UX pass](054-ritual-editor-ux.md), agreed with Gadi after
he tried the new editor. Real phone testing stays deferred.

## What changed

**Slash commands.** One registry in `ritualSlashCommands.ts` drives the `/`
menu, its search and a quiet empty-line hint (“Type / for speech, action, note
or section title”), so a new command needs only an entry there. Note inserts an
empty note with the caret inside; Section title inserts a title whose
placeholder is selected so typing replaces it, and only at the top level. Each
menu item shows a one-line description. The hint shows only in the focused
editor and lists only the commands that editor can run (collected footnotes
have no blocks). A separate help popup was considered and dropped: the hint
says that `/` exists, and the open menu explains itself.

The menu used to clamp its top to the window height minus 260 px, so near the
bottom of the fixed editor it covered the lines above the caret. It now
measures itself and opens below the line when it fits, otherwise above it, or
on the roomier side with a shorter list, against the visual viewport.

**Leaving a task.** Enter in an empty last paragraph of a task moves that
paragraph after the task, as Enter leaves a list, so the hint offers the next
speech or action. A task's only paragraph stays.

**Caret following.** In split view the panel without focus follows the
caret's node: visual → the source scrolls to the node's header line; source →
the visual editor scrolls to the nearest enclosing node it can show. It acts
only when the node changes, never moves the other panel's caret or focus, and
leaves a visible node alone, so it does not fight manual scrolling. Node lines
come from an indentation scan in `ritualPugIds.ts`.

**Source-only blocks.** A top-level node that cannot round-trip through the
visual editor becomes one “Needs source editing” block holding the node
verbatim (the atom's `raw`), instead of making the whole ritual source-only.
The whole-document round-trip check still guards the result; if only the
combination fails, the old fallback remains. ID normalization renames
duplicated IDs inside atoms once, so pasted copies stay stable, and pasted
payloads must be valid semantic nodes. A notice counts the blocks and “Show
line N” opens the source at the first.

**App bar.** It titles `/doc/<id>/edit/semantic` “Ritual editor” through a
short pattern list (the static map's entries are drawer links), and it renders
signed out until hydration, avatar included, removing the hydration mismatch
seen on every page.

The local MinIO bucket's orphaned bundle objects from the deleted UX-review
ritual were removed (8 objects; only the fixture's two remain referenced).

## Proposal: grade and variable shortcuts in source

The previous Pug editor (`src/doc/shortcuts.ts`) also had `0=0` grade and
`${templeName}` variable shortcuts; Ritual Pug kept only `Label:` and
`* Label`. Grades and variables print as `#[grade#ID(grade="0=0")/]` and
`#[var#ID(name="templeName")]`, usually between `#[ritualText(value="")/]`
wrappers: the legacy import keeps empty text nodes at interpolation
boundaries. The Neophyte has 7 grades and 22 variables.

Recommended, pending Gadi's decision:

1. Shortcuts that keep IDs: `0=0#ID` and `${templeName#ID}` in pipe and inline
   text, folded like other IDs so authors read `0=0#…`. Typed without an ID they
   get a fresh one. The printer wraps literal text that would read as a
   shortcut, so exactness (plan 053) holds.
2. Normalize empty text nodes away once, at import and on the next save, after
   proving reader-tree equality over the corpus; that removes most remaining
   wrappers.

Rejected: ID-less shortcuts as in the old editor. Every reparse would issue new
IDs, so source edits would churn the saved document and break the identity
contract.

Related: a speech whose text does not start with the space `Label:` itself adds
prints as `say#ID(role=…)`. Dropping that implicit space would change reader
output (it shows as `“ Fratres`), so it needs its own decision.

## Follow-ups

- Real phones, Safari, IME and assistive technology: deferred; review the
  fixed-height surface with an on-screen keyboard and short landscape screens.
- Grade and variable shortcuts, and empty-text normalization (above).
- Footnote numbering in the editor ignores footnotes inside source-only blocks;
  saved data and the reader are unaffected.
- The follow scan can misread hand-typed multi-line attribute lists and
  comment-block bodies; printed source is unaffected.

## Commits

| Commit | Change |
| --- | --- |
| `6cc55cf` | Slash registry, Note and Section title, hint, menu position, Enter leaves a task |
| `18a6b4d` | App bar hydrates signed out |
| `e03f4ae` | App bar titles the editor |
| `5925af0` | Split panels follow the caret |
| `e9d0b50` | Source-only blocks |
| `f4ff879` | Independent review fixes |
| `9650c4a` | Final review fixes |
| (this commit) | This plan and status follow-ups |

## Verification

Every commit passed `pnpm check`, `typecheck`, `test:coverage` (per-file
thresholds met) and the webpack `build` in a separate worktree with one fresh
frozen install and CI's placeholder environment; the tip also passed
`loom init`, both `loom check`s, the `magick-data` smoke test and
`check:turbopack`, leaving the tree clean.

A headless Chromium against the branch's dev server, signed in as the local
Creator on the seeded Neophyte fixture, checked: the menu opening above a
caret near the bottom (caret top 860 px, menu bottom 855 px), the hint shown
only while focused, `/title` and Enter leaving a task, caret following both
ways (source line 820 brings its speech into view), the app bar's “Ritual
editor”, and the original Neophyte's mismatched title as one “Needs source
editing” block with the rest visually editable and “Show line 313” opening the
source there.

Reviews: an independent fresh-context Opus 5.5 review found ID churn on pasted
source-only blocks, an avatar hydration mismatch, a no-op narrow “Show line”
and smaller issues, all fixed in `f4ff879`. The final adversarial Fable 5.1
review found no data-loss path. Its 3,000-document round trips, guide examples
and legacy imports were byte- and ID-exact. It did find a source-only task that
could be pasted inside a task, and an opaque error when a title was emptied.
Those, and three smaller items, are fixed in `9650c4a`. Not done:
`decorations(state)` still reads `editor.state`, which is correct while
ProseMirror assigns the view state first.
