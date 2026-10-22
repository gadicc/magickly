# Ritual editor UX pass — 5 October 2026

The ritual editor (`/doc/[id]/edit/semantic`) was functionally complete after
plans 047–053, but nobody had looked at it as a whole. A UX pass on 5 October
loaded the full 0=0 Neophyte (1,096 lines of Pug, 454 top-level nodes) as a
synthetic Creator and measured the editor at 1440×900, 820 and 390 pixels wide.
Gadi agreed with every finding. This plan records what changes, in which
order, and what is deliberately left for later.

## Findings, ranked

1. **The page scrolls, not the panels.** With the Neophyte loaded the page is
   about 48,000 px tall. Toolbar, Save and title scroll away; the app bar hides
   on scroll; in split view the 585 px CodeMirror stays at the top of its
   column, so mid-document half the screen is empty. Two scrollbars, no
   connection between the panels' scroll positions.
2. **Reprinted source is unreadable.** Text that spans several Pug pipe lines is
   stored as `[text, "\n", text]`. The printer could only print that through
   `#[ritualText(value="\n")/]` wrappers: the Neophyte reprints as 499 lines
   containing 775 wrappers, and every visual edit or save reprints it. Plan 053
   counted 2,040 wrappers across the three bundled rituals.
3. **Chrome above the editor.** At 1440×900 the first editable line is at
   y≈360, and y≈500 after a save because notices stack and never dismiss; on a
   phone it is at y≈760 of 844. The h1 is a generic “Ritual editor”; “Publish
   saved version for download” sits alone in a centred row; “Download draft”
   has the same weight as Save.
4. **No save state.** Nothing shows unsaved changes; Save with nothing changed
   writes an identical revision; Ctrl/Cmd+S opens the browser's Save dialog
   (the legacy editor handled it).
5. **Typing flow.** The slash menu needs `/say <role>`; typing a role first
   (`/ker`) closes the menu and leaves literal text.
6. **Toolbar.** Eleven text buttons of equal weight plus a “Role for new task”
   field; two rows in split view, four on a phone; no icons, tooltips,
   shortcuts or active state for Bold/Italic.
7. **All-or-nothing visual fallback.** One title whose `text=` attribute
   differs from its body made the whole Neophyte source-only, with no hint of
   which node or line.
8. **Phone.** Split stacks source over visual; nested gutters leave about
   280 px of 390 for text.
9. **Visual density.** Four nested frames; 1,330 px wide cards in visual mode;
   six variable declarations take six full rows; images show only their path.
10. **Source panel header and errors.** Two lines of help and a separate
    “Show IDs” row; Save's tooltip says “catching up” during a source error.
11. **Dialogs.** The link dialog is titled “Insert ritual structure”; the
    “Structure” label is clipped; no first-field focus.
12. **No way back.** No link to the reader.
13. **Polish.** Line breaks in text show as breaks in the editor
    (ProseMirror's `pre-wrap`) but collapse to spaces in the reader; the
    editor's loading states are bare paragraphs.

## Decisions

**Layout (1, 3, 8).** The revision editor becomes a viewport-height work
surface: `height: calc(100dvh - 56px)` below the app bar's spacer, so the window
does not scroll and the app bar stays put. A one-row header holds the title
field, save status, layout switch, Publish, Save and an overflow menu (Download
draft, View ritual, Ritual Pug guide). Errors and warnings that need action
stay as alerts under the header; success notices (“Saved.”, “Published for
download.”, “Recovered the local draft.”) become a transient snackbar. Each
panel is a column with its own toolbar row and its own scroll area; CodeMirror
fills its panel. Scroll positions are not synchronised in this pass (see
Follow-ups). The creation editor shares the panel styles but stays an inline
form; its layout is unchanged except for the shared toolbar.

Below the existing 800 px breakpoint the layout switch offers Visual and
Source only, and a stored “split” preference displays as Visual without being
overwritten. The visual toolbar becomes one horizontally scrolling row.

**Save state (4).** The editor tracks the last saved title and document. Save
is enabled only with changes, a pending request to retry, or an unsaved legacy
conversion (the conversion itself is the change). The header shows “Unsaved
changes”, “Saving…” or “Saved”. Ctrl/Cmd+S saves when Save is enabled and is
always kept from the browser while the editor is mounted.

**Pipe-line printing (2, 13).** The printer prints an element's inline
children as Pug pipe lines whenever that is exact: children split on
standalone `"\n"` text nodes into non-empty inline segments, each printed as
`| …` with the existing inline rules; runs of k newlines become k−1 blank `|`
lines. A say task whose children start with the `" "` that `Label:` itself
produces prints as `Label#id:` followed by the pipe lines; other tasks and
elements keep their usual header. Anything else falls back to the existing
wrappers. Probed against the real parser: consecutive pipe lines insert one
`"\n"`, a blank pipe line one more, element lines and comments none. Exactness
is the contract (plan 053): parse(print(doc)) must equal doc, tested over the
bundled corpus and randomised documents. The stored semantic JSON does not
change.

In the visual editor each `"\n"` inside text is decorated to collapse like the
reader's whitespace, so a soft line break displays as a space, as readers see
it. Explicit `br` nodes still display breaks.

**Toolbar and dialogs (6, 11).** Groups: Speech · Action · Note · Insert… |
Link · Image · Bold · Italic | Undo · Redo | Properties. Insert… keeps its
dialog with a structure select (section title, summary, to-do, variable
reference, variable declaration); Link and Image stay separate buttons rather
than joining an Insert menu, which keeps their existing flows and tests. Formatting and
history are icon buttons with tooltips naming their shortcuts and
`aria-pressed` for marks; accessible names stay as today. Speech and Action
open a role menu (Everyone, All officers, then the role catalog, the last role
first) instead of the free-text role field. Dialog titles follow the
structure being inserted; the first field takes focus; Enter submits.

**Slash menu (5).** A query that does not match Speech/Action lists matching
roles as “Keryx · Speech” and “Keryx · Action”, so `/ker` Enter works. The
existing `/say ker ` fast path, history and container rules are unchanged
(plan 050). More slash commands (Note, Section title) remain a follow-up.

**Visual fallback location (7).** When visual editing is unavailable, the
warning names the first top-level node that fails the round trip and its
source line, with a button that selects that line in the source panel. Showing
the rest of the ritual visually needs a per-node source-only block and is a
follow-up.

**Visual density (9).** The visual panel drops its border and padding; in
visual-only mode the document column is capped at about 52 rem and centred.
Consecutive variable declarations wrap as compact chips. Image thumbnails for
the image atom are a follow-up (they need the scoped-asset preview path).

**Source panel header (10, 12).** One row: “Ritual source”, Show IDs / Go to
error / Problems, and a help button whose tooltip holds the old two-line hint
and links to the guide. Save's tooltip names the actual blocker.

## Stages

Each stage is one or more commits on `gate/editor-ux`, gated before it lands.

1. This plan.
2. Pipe-line printing and soft-break display.
3. Work-surface layout, header, notices and save state.
4. Toolbar, role menu and dialogs.
5. Slash role search and visual fallback location.
6. Visual density and the narrow layout.

## Follow-ups

- Scroll synchronisation between source and visual by node ID.
- Show the rest of a ritual visually when one node needs source editing.
- Slash commands for Note and Section title; Enter on an empty trailing task
  paragraph to leave the task.
- Previews for attached and site images exist; other image URLs stay captions
  by design.
- A page title in the app bar for editor routes; the app bar's hydration
  mismatch (present on every page).
- Physical phone keyboards (including the fixed-height surface with an
  on-screen keyboard and short landscape screens), Safari and assistive
  technology remain unverified.

## Commits

| Commit | Change |
| --- | --- |
| `82ec5a1` | This plan |
| `4f421d1` | Pipe-line printing |
| `6a924b6` | Soft line breaks display as spaces |
| `3efc62d` | Work surface, header, notices, save state, Ctrl/Cmd+S |
| `f07dab2` | Toolbar groups, role menu, dialog fixes |
| `d31a1c8` | Role-first slash search |
| `fd9929b` | Visual fallback names its line |
| `3b72a8c` | Visual density, site image previews, narrow padding |
| `09839da` | Toolbar wraps outside phones |
| `bcc8d4e` | Independent review fixes |
| `7f3b1cd` | Final review fixes |
| (this commit) | Verification record and status follow-ups |

## Verification

Every commit passed `pnpm check`, `typecheck`, `test:coverage` (per-file
thresholds met) and the webpack `build` in a separate worktree with one fresh
frozen install (no commit changes dependencies) and CI's placeholder
environment. The tip also passed `loom init`, `loom check`,
`loom check --production`, the `magick-data` smoke test and
`check:turbopack`, leaving the tree clean.

Measurements on the bundled corpus: wrappers drop from 2,040 to 214 with
parse(print(doc)) still equal to doc for all three rituals; the Neophyte
reprints as 958 lines with 41 wrappers instead of 499 lines with 775. A seeded
600-document round trip (nested notes, sibling comments, Pug-significant text)
is part of the suite; the independent reviewer's separate fuzz of about 11,000
valid documents found no mismatch.

A headless Chromium against the gate worktree's dev server, signed in as the
local synthetic Creator with the full Neophyte, checked: the window no longer
scrolls at 1440×900 or 390×844, both panels scroll independently, the first
editable line moves from y≈360 to y≈220, Ctrl+S saves and the status moves
from “Unsaved changes” to “Saved”, the role menu and dialogs, the fallback
warning's “Show line 313” on the original Neophyte, chips and previews, and
the creation form with the shared toolbar. Real phones, Safari, physical
keyboards with IME and assistive technology were not tested.

Reviews: an independent fresh-context Opus 5.5 review found a dialog submit
escaping into the creation form, a site-image filter bypass, a stuck
publishing status, auto-hiding follow-up notices and several smaller issues,
all fixed in `bcc8d4e`. The final adversarial Fable 5.1 review found no
data-loss path and no printer mismatch in a further 3,000-document fuzz. It
did find a bug already on `main`: U+2028/U+2029 on a `Label:` shortcut line
made source unparsable. It also found four smaller issues: a source error
hidden on narrow screens with a stored split, a retained request's JSON
formatting reading as unsaved, Ctrl+S under non-Latin layouts, and the
debounced draft lost when leaving through the new menu. All five are fixed
in `7f3b1cd`.

Unverified, needing real devices: the fixed-height surface with an on-screen
keyboard (Android Chrome resizes only the visual viewport by default, and iOS
Safari has its own behaviour), and landscape phones about 390 px tall, where
the header, any notices and the toolbar leave little room for the document.

## Creation opens the editor — 22 October 2026

Gadi asked that `/gd/rituals` stop carrying the whole editor: "Create
ritual" now asks only for Title, Visibility and (for a temple) Min Grade,
creates the ritual and opens `/doc/<id>/edit/semantic` in the editor's
remembered layout (`8b17380`). This supersedes the inline creation editor
described under Decisions.

- **Initial source.** A SQL-v3 create with an empty semantic document,
  `{"format":"magickli-ritual","version":1,"nodes":[]}`. The validator and
  compiler accept it. Its source is `//- magickli-ritual-pug 1`. The
  "Type /" hint shows only in a focused visual editor, so when the editor
  first becomes editable on a ritual with no nodes it puts the caret in
  it: the visual editor, or the source's empty last line in Source
  layout. The author can type at once and the hint shows.
- **No format choice.** The Legacy Pug option went: nothing needs to create
  legacy rituals, and `/doc/<id>/edit` already redirected them to the
  semantic editor. A SQL-v2 request retained by the old form still replays
  byte for byte and opens the editor.
- **Retry and recovery** are unchanged: a pending or uncertain create is
  retried with its retained operation, and a replayed acknowledgement opens
  the existing ritual. After an acknowledgement the form clears its draft
  and pending request and gives way to "Ritual created. Opening the
  editor…", whose link takes the focus; later access checks keep that
  notice, and a lock returns an empty form.
- **Removed:** `RitualCreationEditor` and its tests, the legacy
  `pugRitualStarter` (`ritualPugStarter` stays for the Ritual Pug guide),
  and the visual toolbar's "Images can be attached after creating the
  ritual" branch: `RitualVisualControls` now requires `actorId` and
  `ritualId`.
- **Bundle** (webpack production build, `/gd/rituals`, every client chunk of
  the route plus its lazy chunks): 2,751 KiB raw / 876 KiB gzip before, of
  which the editor's lazy chunk was 1,296 / 416; 1,238 / 396 after, with no
  lazy chunk. The route's first load fell from 463 to 396 KiB gzip.
- **Docs screenshots:** `create-ritual` now clips the whole creation area
  with a title typed, and needs recapturing with the owner's dev stack.
- **Moot follow-up:** the hall field in the creation form saved by a Create
  button that does not take the focus (Safari) no longer applies; it is
  removed from `000-current-status.md` (plan 061 still records it).
- **Follow-up:** plain text typed into an empty document becomes a
  top-level `ritualText` (and a `br` per line break) rather than
  paragraphs. That is existing visual-editor behaviour, now met first
  by every new ritual.
- **Checked** in headless Chromium against a local dev server: the form, the
  create, the redirect (about 2 s) and typing into the new ritual's visual
  editor; after the review fixes, reopening that empty ritual put the
  caret in its visual editor with the hint showing, and the form's
  `aria-describedby` named its help line. The local dev database keeps two
  test rituals for the owner to delete: "Create redirect check (agent)"
  (`01a16538-bc9d-7567-ae3f-7b9a175d362e`, Example temple, grade 0) and
  the reviewer's "Create redirect review (agent)".
