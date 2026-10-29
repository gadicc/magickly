# Linked selection in the hall editor — 29 October 2026

Status: planned on `gate/hall-sync`, reviewed (Fable) and answered by
Gadi on 29 October 2026; amended the same day with both, below, then
built on the same branch from `main` at 05dd5f6e, every commit gated;
see "The build". Awaiting review. Read
[current status](000-current-status.md) and the stage E notes of
[plan 061](061-gd-hall.md) first.

Gadi approved the feature for `/gd/halls/editor` in split view:

- Selecting an item in the drawing moves the source caret to that item's
  tag and scrolls it into view.
- Moving the caret in the source (a click, the arrow keys) selects the
  matching item in the drawing.

## Gadi's answers, 29 October 2026

"All as recommended", with question 3 changed:

1. A line that is not an item selects the enclosing item; the hall's own
   line and hall-level comments clear the selection (decision 1).
2. The caret line's mark while the source is unfocused is style B of the
   mock-ups: a tint plus a 3 px left bar in the primary colour, shown
   only outside `.cm-focused` (decision 2).
3. **Changed:** an item selected from the source that is out of view in
   the drawing is scrolled into view by the drawing's own scroll
   container, just enough (nearest), clear of a docked panel. Never the
   page (decision 3). Later the same day, asked again once the build
   showed that this page's drawing has no scroll container of its own,
   Gadi said yes to scrolling the page when the panels stand side by
   side (from 900 px, the source panel sticky), just enough, clear of
   the app bar; never stacked, never for a selection made in the
   drawing.
4. The link stays on in the stacked split view on phones; the page never
   scrolls (decision 6).
5. While typing, the item under the caret is selected again at each
   200 ms read (decision 3).

## The review, 29 October 2026

A Fable review found the design sound and asked for these, folded into
the decisions below:

1. Put the caret back and scroll inside `view.requestMeasure`, not in the
   layout effect that applies a new `value` (CodeMirror's height oracle
   is still an estimate there); keep `centredScrollTop` pure; scroll even
   when the caret is already in place but out of view.
2. A line where no node starts belongs to the nearest node above that
   starts at or before its indentation, as Pug reads it (and as
   `ritualPugNodeIdsAtLine` scans), not to the last node above. Tests for
   the final empty line and two or more trailing blank lines.
3. A parse costs about 107 ms per 1,000 nodes: never parse in a caret or
   keystroke path. A printed source (`entryOfHall`: visual edits,
   presets) is mapped from the printer's layout without parsing; a typed
   or loaded source reuses the parse that read it
   (`parseHallSourceWithLocations`, kept in `entryOfSource`); with no
   map, the link waits.
4. Strict mode recreates the `EditorView`: apply a caret request per view
   instance.
5. Apply a selection request after GdHallEditor's effect that clears a
   vanished selection, so a tag without an ID stays selected across
   reads.
6. Keep the caret and the focus origin in refs; re-render the page only
   when the caret's resolved row path changes.
7. No `showCaretLine` prop: the mark is the page's CSS, shown only while
   the drawing has a selection.
8. The editor is `@codemirror/view` 6.43.12 (6.38.4 is a second copy in
   the install, a TODO in plan 000).
9. Normalise `\r\n` so such a draft or link still gets a caret.
10. Coverage of every `selectPath` case.

The coordinator's defaults for the review's questions: no node ceiling
unless the 1,000-node check shows lag; the mark only while something is
selected; diagnostic navigation (F8, Problems) moves the caret, so it
selects in the drawing too, which is fine.

## What exists (read for this plan)

- **Locations.** `parseRitualPugWithLocations` (`src/doc/ritualPug.ts`)
  gives every semantic node its start (1-based line and column, of the
  tag name). The source panel's text is header-less, one line off a
  ritual's. A `//-` comment and a blank line inside a hall are annotation
  nodes with locations of their own: a blank line at column 1, at the
  depth of the block it is in or precedes; a comment carried onto further
  lines at its first line. Only an attribute list or a comment carried
  onto further lines, and the final empty line, start no node.
- **The printer** writes a hall one node per line, in document order,
  two spaces a level (`printRitualPug`'s hall branch: no inline, pipe or
  shortcut forms; a multi-line comment as one `ritualComment` line), and
  ends with a newline.
- **Row paths.** `indexHall` (`hallModel.ts`) indexes a hall by ID and by
  `rowPath`, which skips annotations. `selectableForPath` (`hallEdits.ts`)
  finds a path's nearest drawn ancestor, as the warnings list uses it.
- **IDs alone are not enough.** A node typed without an ID gets a fresh
  random ID at every read, and the ID line scan cannot follow an
  attribute list over several lines. The link keys on row paths.
- **GdHallEditor** keeps `selectedId` in its own state; `select()` also
  announces, `markReveal()` scrolls a selection made by a key into view
  (`scrollingAncestor` or the window), and an effect clears a vanished
  selection. `GdHallAtomEditor` (the ritual editor) passes no selection
  props.
- **HallPlayground** shows `typed ?? present.source`; typing is read
  after 200 ms. While the source holds no hall, the drawing shows the
  last one, read-only. The panel that stays mounted across a layout
  change keeps its state. Below 900 px split view stacks the panels.
  **On this page the drawing has no scroll container of its own: the
  page scrolls it** (`scrollingAncestor` finds none).
- **RitualSourceEditor** applies a new `value` with `setState`, which runs
  no update listeners and maps the caret through one prefix/suffix diff.
  `EditorView.scrollIntoView` scrolls every scrolling ancestor, the
  window included.
- **CodeMirror unfocused** (6.43.12's base theme): the caret is hidden;
  the active line (`#cceeff44`) and its gutter (`#e2f2ff`) are drawn too
  faintly to read.
- No documentation screenshot shows the hall editor.

## Decisions

### 1. A pure map between source and row paths

`src/doc/gdHallEditor/hallSourceMap.ts`:

```ts
export interface HallSourcePlace { line: number; column: number }
export interface HallSourceMap {
  placeOf(path: readonly number[]): HallSourcePlace | undefined;
  pathAt(place: HallSourcePlace): readonly number[] | null;
}
export function hallSourceMap(
  hall: HallElement,
  source: string,
  locations?: HallSourceLocations,
): HallSourceMap | null;
```

With `locations` it reads the parse that gave `hall`; without, `source`
must be the printer's, and the map follows its layout in O(n) (null if
the line count says otherwise). `parseHallSourceWithLocations` in
`gdHallPug.ts` gives the hall and its header-less locations from one
parse; `parseHallSource` calls it, and `entryOfSource` keeps the
locations on the `HallEntry` (and normalises `\r\n`).

**A caret's owner** is the node that starts on its line (the last at or
before its column, else the first). In a hall every line starts a node,
a blank line too, but those that carry one on: an attribute list or a
`//-` comment continued onto further lines, at any indentation and with
blank lines among them. Such a line is the node's above it. After the
source's last line with content, lines are the hall's own; before the
hall, outside it. An element selects its own row path, a comment or
blank line its parent's. So an attribute list's further lines and its
`)` are the tag's, wherever they stand; a comment's further lines, and
blank lines between them, the comment's parent's; the `gdHall` line,
hall-level comments, trailing blank lines and the final empty line
`[]`; blank lines before the hall `null`. The drawing selects the
path's nearest drawn ancestor; `[]` and `null` select nothing. (The
review's rule, by indentation, gave an attribute list continued less
indented than its tag to the parent, and a blank line inside a comment
to whatever was less indented; the second review found both, and this
rule, which needs no indentation, replaced it.)

### 2. Drawing → source

- **When:** the drawing's selected node or its row path changes while
  the visual panel had the focus last; and after every new
  `present.source` while it has a selection, since `setState` can move
  the caret off its line. A cleared selection leaves the caret.
- **Where:** a collapsed caret at the start of the tag name.
- **Scroll:** only `view.scrollDOM`, inside `view.requestMeasure`, centred
  when the line is not wholly in view (`centredScrollTop`, pure); even
  when the caret is already there.
- **Focus:** no `focus()`; the drawing keeps the focus.
- **Mark (B):** `hallPlayground.module.css` tints the active line and
  gutter and adds a 3 px `#1976d2` bar, outside `.cm-focused`, while the
  source panel has `data-linked-caret` (split view, something selected).

### 3. Source → drawing

- **When:** the author's own caret moves while the source has the focus
  (a click, the keys, typing, diagnostic navigation), never `cursor`
  requests or a new `value`.
- **Stale text:** the caret is held with the text it was in; it selects
  only when that text is `present.source` and the source holds a hall.
  The read of the typing it came with makes it so (answer 5). An undo, a
  preset or a link replacing the source first suspends it: it selects
  nothing until the text is its own again (a redo back to that text
  selects it). With no map, nothing happens.
- **No focus, no announcement:** `setSelectedId`, not `select()`.
- **Reveal (answer 3):** the selection is scrolled into view by the
  drawing's scrolling ancestor, nearest and clear of a docked panel
  (`markReveal`'s path, contained). With none, as on
  `/gd/halls/editor`, the page scrolls instead only when the request
  carries `pageInset`: the page gives it (the app bar's 64 px) while
  the panels stand side by side (`(min-width: 900px)`), where the
  sticky source stays put; stacked, nothing scrolls. A selection made in
  the drawing never asks. Either way the node is shown whole, its label
  and text with its box (`drawnRect`), 16 px clear of the edges; one
  taller than the room shows from its top.

### 4. Loops and echoes

The page records which panel last had the focus (`onFocus` on each
section, in refs). Drawing → source acts only for the visual panel;
source → drawing reports exist only while CodeMirror has the focus. A
caret request carries an annotation the listener skips, and `setState`
runs no listeners. Requests are idempotent.

### 5. API changes

`GdHallEditor`, optional, so `GdHallAtomEditor` is unchanged:

```ts
onSelectionChange?: (
  selection: { id: string; path: readonly number[] } | null,
) => void; // on mount, then on each change of the ID or path
selectPath?: {
  path: readonly number[] | null;
  hall: HallElement;
  pageInset?: number; // the page may scroll too, this much kept clear
} | null; // applied once per object, if `hall` is held, not mid-gesture
```

`RitualSourceEditor`, optional; the ritual editor passes neither:

```ts
onCursor?(at: { line: number; column: number }): void;
cursor?: { line: number; column: number; source: string } | null;
```

The page's logic is `useHallSelectionLink`
(`src/app/gd/halls/editor/hallSelectionLink.ts`).

### 6. Split view, one panel, phones

Linked in split view only. On entering split view the panel that was
showing leads: its selection or caret goes to the panel that appears.
On phones the link stays on and the page never scrolls. Not checked on
real devices or Safari.

### 7. Accessibility

A selection from the source is not announced; the drawing's non-live
description and the panel update silently. A caret moved from the
drawing is silent too.

### 8. Tests and checks

95/90 per file for `hallSourceMap.ts` (added to the list),
`GdHallEditor.tsx`, `HallPlayground.tsx` and `hallSelectionLink.ts`.
Unit tests for the map (every preset, printed against parsed; a typed
hall over several lines; the final empty line and trailing blanks),
the editor (`onSelectionChange` for each cause; `selectPath` for null,
`[]`, a missing path, another hall, mid-gesture, the current node, the
drawn ancestor, a tag without an ID across reads, the contained
reveal), the source editor (`cursor`, `onCursor`, `centredScrollTop`)
and the page and hook. A headless Chromium check at 1,440 × 900 and
390 × 844, with a 1,000-node hall.

### 9. Out of scope

The same link in the ritual editor's split view: a TODO in plan 000.

## Commits and gates

1. `feat(gd): Map hall source to drawing paths`
2. `feat(gd): Follow drawing selection in the source`
3. `feat(gd): Select hall items from the source caret`

Each gated alone in a clean `git archive` export under `~/.cache/gates/`
(install, check, typecheck, test:coverage, build); the tip also runs
`loom check`, the `magick-data` smoke test and `check:turbopack`
(compared with `main` if it fails). The compiler identity files and
`src/components` are untouched.

## Risks

- A path applied to another hall: the map is built from the entry it
  describes; `cursor` carries its source and `selectPath` its hall.
- The shared source editor: new behaviour only behind optional props.
- Scroll arithmetic below the viewport is an estimate until measured.
- The focus-origin rule is a heuristic (a toolbar Undo after typing).

## The build, 29 October 2026

Three commits on `gate/hall-sync` after this plan, each gated alone
(`~/.cache/gates/hallsync/gate.sh`: a `git archive` export, install,
check, typecheck, test:coverage, build), the tip with the full checks:

1. `feat(gd): Map hall source to drawing paths`: `hallSourceMap.ts`,
   `parseHallSourceWithLocations`, the locations and `\n` line breaks in
   `entryOfSource`.
2. `feat(gd): Follow drawing selection in the source`:
   `onSelectionChange`, `cursor` and `centredScrollTop`, the caret
   line's mark, `useHallSelectionLink`'s drawing half.
3. `feat(gd): Select hall items from the source caret`: `onCursor`,
   `selectPath` with its contained reveal, the hook's source half.

Where the build departs from the decisions above: `selectPath` and
`cursor` are applied once per object (no `key`); the page re-renders
for a caret move only when the caret comes to another item. The caret
is found by the selected node's ID in the entry's hall, so a node an
edit moved is found before the drawing reports its new path.

### The browser check

Headless Chromium over CDP against a production build of the tip's
tree (`next start -H 127.0.0.1`, the gate's placeholder environment),
at 1,440 × 900 and 390 × 844 (mobile emulation), the Neophyte hall:

- Tab and a click in the drawing put the caret on the item's tag
  (column of the tag name) with the mark; nudges, a copy (the caret on
  the copy), Delete (the caret left where it was), undo and redo, an
  object added from the palette all behaved as decision 2 says; the
  focus stayed in the drawing and the page did not scroll.
- A click and the arrow keys in the source selected the item of each
  line (a banner, an officer on a platform, the platform), the `gdHall`
  line nothing; the focus stayed in the source. Typing an attribute,
  and a tag typed without an ID, were selected at the read, and again
  at the next read with a fresh ID.
- Answer 3, as first built: the Sentinel, selected from the source with
  its box at the foot of the window (y 894 of 900), did not scroll into
  view, since this page's drawing has no scroll container of its own.
  After Gadi's yes (above), checked again the same way: at first the
  page scrolled 53 px and showed the Sentinel's box but cut its label
  off at the window's foot, so the reveal now takes in the label. Then
  the page scrolled 74 px, the label's foot at 885 (the window's 900
  less 16 px, give or take the text's own box), the source panel and
  the focus where they were (screenshots 07 and 08); the Hegemon,
  already in view, moved nothing; on a phone (stacked) the page stayed
  at 0 with the Sentinel below the fold (09).
- Phone (stacked): a tap in the drawing, with the page scrolled to the
  drawing, moved the caret and scrolled only the source box (to 361 px);
  `scrollY` stayed at 900. A click in the source selected in the
  drawing. Headless Chromium's synthesized tap does not focus
  CodeMirror (on the desktop either), so the source was clicked.
- 1,000 nodes (a caption, a floor, 997 markers), typed in as one
  paste: a caret move to the next marker drew its box in 41 ms (median
  of 20; at most 60) with no long task; Tab in the drawing moved the
  caret in 24 ms. The long tasks left are the read of typing (126 ms,
  the parse and layout the page already did) and a nudge (257 ms, the
  layout). No node ceiling is needed.

Screenshots and the logs: `.mockups/hall-sync/` in the worktree (not
committed).

### Review fixes, 29 October 2026

Two reviews of the branch: Fable's found it ready to merge, Opus's
found one blocking bug. Each fix is folded into the commit it belongs
to:

- **Blocking: a stale caret leading into split view.** The caret the
  link held was only the author's, so after the drawing moved it (Tab to
  another item), going to Source and back to Split selected the item of
  the author's last caret. The caret the link places is now recorded as
  the source's caret, and forgotten when the source panel goes (Visual).
  Page tests for split → source → split and split → visual → source →
  split.
- A request made during a drag is dropped, not applied after it (the
  next Tab goes on from the dragged node); one for a hall not yet held
  still waits for it.
- The caret line's mark shows only while the source holds the hall
  drawn: not while it has an error.
- The owner rule of decision 1, above.
- `cursor`'s contract: give it with, or after, the value it names.

## Follow-ups

- The same link in the ritual editor's split view (plan 000).
- A second `@codemirror/view` in the install (plan 000).
- Real phones and Safari, as for the rest of the hall editor.

