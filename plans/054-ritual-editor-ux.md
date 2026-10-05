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

**Toolbar and dialogs (6, 11).** Groups: Speech · Action · Note | Insert ▾
(section title, summary, to-do, variable reference, variable declaration,
link, image) | Bold · Italic | Undo · Redo | Properties. Formatting and
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
- Image thumbnails in the visual editor.
- A page title in the app bar for editor routes; the app bar's hydration
  mismatch (present on every page).
- Physical phone keyboards, Safari and assistive technology remain unverified.

## Verification

To be filled in per stage.
