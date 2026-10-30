# Linked hall selection in the ritual editor — 30 October 2026

Status: planned on `gate/ritual-hall-link` from `main` at 364f7e51,
reviewed (Fable) and revised the same day; see "The review" below.
Read [current status](000-current-status.md) and
[plan 063](063-hall-selection-link.md) first: this plan carries 063's
link from `/gd/halls/editor` into the ritual editor, the follow-up its
§9 left.

Gadi's decisions, 30 October 2026:

1. **Drawing → source moves the caret.** In the ritual editor's split
   view, while a hall is open for editing (its Edit hall button opened
   `GdHallAtomEditor` in the atom's node view), selecting an item in
   the drawing moves the ritual source's caret to that item's line,
   with the hall editor page's caret-line mark (style B); the focus
   stays in the drawing, so arrow-key nudges keep working.
2. **Only while Edit hall is open.** With the hall closed, a caret on
   one of its lines behaves as today: the visual panel scrolls to the
   hall block. The link never opens the hall editor by itself.
3. **Off-screen items:** the visual panel scrolls just enough to show
   the item with its label (plan 063's reveal: `drawnRect`, 16 px
   clear), inside the panel's own scroller. The item reveal wins over
   the block follow that would place the whole hall.
4. **Phones:** split shows as Visual below 800 px, so there is no link
   there and nothing to build.

The plan's questions, settled with the review the same day:

5. A caret outside every open hall keeps the drawing's selection and
   asks for nothing; the hall's own line, or a hall-level comment,
   clears it.
6. A caret coming to the item already selected scrolls it into view
   (`revealSelected`), but only for a caret that moved, never at a
   read of typing.
7. A blank line inside a hall, and the further lines of an attribute
   list carried over several lines, are accepted limits (decision 1).

## Why the hall is the exception

Everywhere else in the ritual editor the source only scrolls to follow
the visual panel (`follow`) and never moves its caret, because the
visual panel has a caret of its own in the same text, and moving the
source's would lose the author's place for no gain. An open hall is
different: it is the same `GdHallEditor` as the hall page, with a
selection rather than a caret, and the focus stays in the drawing. The
source caret is then the only place the selection can be shown in the
text, it costs the author nothing (they are working in the drawing),
and it gives the hall editor in a ritual the same behaviour as on its
own page. Once the author clicks into the source, their caret is theirs
again (decision 2).

## The review, 30 October 2026

Fable found no blocking defect. Folded into the decisions below:

- **Visual → Split kept the selection only on paper.** With the
  provider null in Visual, the hall editor's registration ended and its
  selection was forgotten, and `GdHallEditor` does not report an
  unchanged selection again. The link object is now provided whatever
  the layout, with `linked` inside it, and entering Split from Visual
  makes the drawing lead, as on the hall page (decisions 2, 5).
- **SemanticEditor's tests mock the source panel as a `<textarea>`**:
  the mock gains `data-cursor` and captures `onCaretNode`, as
  `HallPlayground.test.tsx`'s does (decision 10).
- **The source leads from `caretMoved` itself**, not only from the
  section's focus, so the order of events does not matter (decision 4).
- **`revealSelected` only for a caret that moved** (answer 6).
- **Simpler scrolling.** A caret on an item of an open hall skips the
  block follow, and the item reveal does all the scrolling; the hall's
  own line and everything else keep today's follow. No `partly`
  option, no change to `revealRitualNode`. If the open hall editor is
  not shown (a footnote's hidden canonical body), today's follow runs
  (decision 4).
- **The ritual atom's node view is never re-purposed for another tag**
  (decision 7), so a read does not hand an open hall's view to a
  neighbouring atom.
- **The channel is React state**, not an external store (decision 5):
  SemanticEditor renders anyway for every keystroke in the source; a
  store is kept only if a measurement shows a cost.
- The attribute list carried over several lines joins the accepted
  limits; `insideHallControls` is named as why the block follow never
  fires from the hall editor; the timing wording went with the second
  scroll it described.

## What exists (read for this plan)

- **The printer gives every hall node its ID.** `printRitualPug`'s hall
  branch (`src/doc/ritualPug.ts`, line 390) writes each hall node on a
  line of its own as `tag#id(attrs)`, two spaces a level, and the
  header regex of `src/doc/ritualPugIds.ts` matches it (hall tags are
  `[A-Za-z][A-Za-z0-9]*`, IDs 16 alphanumerics or a UUIDv7). Checked by
  script on the Neophyte hall printed inside a `note`: all 29 hall
  nodes (the hall included) are found by `ritualPugLineOfId`, and
  `ritualPugNodeIdsAtLine` on each node's line names that node first,
  then its ancestors in the hall, the `gdHall`, then the ritual's. A
  `//-` comment line inside the floor gives `[floor, gdHall, note]`.
  **So hall items are reachable by ID; plan 063's `hallSourceMap` is
  not needed.**
- **IDs are unique across the whole document**, hall nodes included
  (`validateRitualSemantic`, `semantic.ts` line 385). Annotations
  (comments, blank lines) have no ID.
- **The limits of the ID scan**, all shared with today's block follow:
  - A hall tag typed without an ID gets a fresh random ID when the
    source is read, but `applySource` keeps the typed text (`dirty:
    false`, not reprinted), so that ID is in the document and the
    drawing, not in the source, until the next visual edit reprints the
    source. Its line's chain starts at its parent.
  - `ritualPugNodeIdsAtLine` gives a blank line to the nearest node
    above it (a leaf sibling, say), where 063's map gives it the
    block's parent. Likewise the further lines of an attribute list
    carried over several lines, its `)` among them, belong to whatever
    the indentation scan finds above them: the tag when they are
    indented deeper than it, else an ancestor. Printed halls have
    neither; only typed ones do.
  - Lines inside a Pug block comment that look like headers
    (`//-` with an indented, commented-out `officer#…`) are read as
    headers; the first header with an ID wins.
  - The scan is meaningful only for the text the document was read
    from: not while `source.dirty` (typing not yet read, an error, a
    conflict), and not in the `ritual-text` recovery dialect.
- **Source state** (`SemanticEditor.tsx`). `source.text` is the print of
  the document after every visual edit (`onUpdate`), or the author's
  text once read (`applySource`, 200 ms after typing). While it is dirty
  the visual editor, and so the hall editor, takes no changes
  (`visualEditable`). A visual edit while it is dirty sets `conflict`.
- **The block follow, both ways.** Visual → source: on Tiptap's
  `selectionUpdate` while `editor.view.hasFocus()`, `follow` scrolls
  the source to the node's header without moving its caret. It never
  fires from the hall editor: `insideHallControls`
  (`src/doc/tiptapRitualClient.ts`, lines 57–65, used by the atom's
  `stopEvent` at 96–108) keeps the hall editor's pointer, key and
  focus events from ProseMirror, so they move no ProseMirror
  selection; and ProseMirror's `hasFocus` is `activeElement ==
  view.dom` (`prosemirror-view` 1.42.4), false while the drawing has
  the focus. Source → visual: `RitualSourceEditor` calls
  `onCaretNode(ids)` while focused, whenever the caret's chain of IDs
  changes (also on focus, as its key is reset on blur), never for a
  caret it was given (`cursor`); SemanticEditor's handler calls
  `revealRitualNode` for the first ID with a visual block. Hall items
  are not Tiptap nodes, so today it reveals the `gdHall` atom: centred
  when not wholly in view, or its top at the panel's top when taller
  than the panel, as an open hall usually is.
- **`RitualSourceEditor`** already has 063's `cursor` (a caret placed
  without focus, refused when its `source` is not the editor's text,
  applied once per object and per view, scrolling only `scrollDOM`,
  inside `requestMeasure`, centred when not wholly in view) and
  `onCursor`. The ritual editor passes neither yet. Nothing in it needs
  to change.
- **`GdHallEditor`** already has 063's `onSelectionChange` and
  `selectPath`. A `selectPath` without `pageInset` reveals inside
  `scrollingAncestor(root)`, which in the ritual editor is the visual
  panel's `.editor` (`overflow: auto`); the surface itself never
  scrolls (`height: calc(100dvh - 56px)`). The reveal shows `drawnRect`
  16 px clear, above a docked panel. A request for the node already
  selected does nothing, reveal included, and an unchanged selection is
  never reported again (the `reported` guard). `GdHallAtomEditor`
  passes neither prop.
- **Tiptap's React node views render inside the React tree.**
  `@tiptap/react` 3.31.3 renders every `ReactRenderer` through
  `ReactDOM.createPortal` in a `Portals` component that `EditorContent`
  renders (`dist/index.js`, lines 22–60 and 119). So a context provided
  above `EditorContent` reaches `RitualAtomForEditing` and the
  `GdHallAtomEditor` it loads (`next/dynamic`), and React's synthetic
  focus events from the drawing bubble to the visual panel's
  `<section>`. A footnote's projected editor renders its own
  `EditorContent` inside an outer node view, so it is inside the same
  tree. A footnote may hold a hall (`block*` content, `li` or `note`
  inside); its canonical body stays in the document, hidden.
- **Node view reuse.** Tiptap's `ReactNodeView.update` accepts any node
  of the same type; ProseMirror's `updateNextNode` offers a changed node
  to the following views of the parent in turn. So a `setContent` (a
  read of the source) can give one `ritualAtom`'s view, with its React
  state, to another atom: an open hall's `editingHall` to an image, or
  an image's view to the hall, closing its editor.
- **The caret mark** (style B) is two rules in
  `src/app/gd/halls/editor/hallPlayground.module.css`, on
  `.sourcePanel[data-linked-caret]`, outside `.cm-focused`.
- **SemanticEditor's tests** render the real Tiptap editor and hall
  editor, but mock `RitualSourceEditor` as a `<textarea>`
  (`SemanticEditor.test.tsx`, line 1920).
- The help pages' screenshots show no open hall; none changes.

## Decisions

### 1. Keyed by node IDs in the ritual source

Both directions map through the IDs the source prints, with the
existing line scans: drawing → source by `ritualPugLineOfId`, source →
drawing by the chain `RitualSourceEditor` already computes for
`onCaretNode`. No parse in any caret path, no hall source map, no
locations kept from `applySource`. Row paths appear only inside the
hall editor's own side (`indexHall`), where `selectPath` needs them.

The link works only on **read text**: `source.dialect === "pug"`,
`!source.dirty`, `!source.conflict`. That text is the document's own,
printed or typed and read, so every ID in it is the document's.

Accepted limits (the "What exists" list): a tag typed without an ID
links through its parent until a visual edit reprints the source (the
drawing selecting it leaves the caret and shows no mark); a blank line,
and an attribute list's further lines, belong to what the indentation
scan finds above them; commented-out header lines can be taken for
headers. Each is what today's block follow and issue lines already do.

### 2. Drawing → source

- **When:** the open hall reports a new selection while the drawing
  leads (decision 4), and again for each new `source.text` while it
  stays selected and the drawing still leads, since a visual edit
  reprints the source and `setState` maps the caret through a diff. A
  cleared selection leaves the caret where it is.
- **Where:** a collapsed caret at the start of the tag name, on the
  line whose header declares the selected ID: `ritualPugLineOfId`, and
  the column after the line's indentation (hall lines have no `* `).
  Given as `RitualSourceCursor` with `source: source.text`, so a cursor
  for older text is refused. None when the ID is not in the text.
- **Scroll and focus:** `cursor`'s own (only the source's box, centred
  when the line is not wholly in view; no `focus()`).
- **Mark:** the source panel gets `data-linked-caret` while linked, on
  read text, while an open hall has a selection and the caret is on
  it: placed there by the drawing, or the source's own caret in that
  hall, which chose it. Not while the drawing's selection has no line
  in the text, nor while the source's caret is outside the hall
  (answer 5 keeps the selection there).
- **Into split view:** the link stays provided in Visual, so the hall
  editor stays registered and its reports keep arriving. Entering Split
  from Visual makes the drawing lead with the selection it holds, so
  the new source view's caret goes to it (063's rule:
  `hallSelectionLink.ts`, `onLayout`), whichever panel had led before.
  Source → Split cannot carry a hall: in Source the visual panel, and
  the hall editor with it, unmounts.

### 3. Source → drawing

- **When:** `onCaretNode` from the author's own caret (a click, the
  keys, typing that changes the chain, diagnostic navigation, Show
  line), while the source leads. Never for a placed caret:
  `RitualSourceEditor` does not report those.
- **Which item** (`hallCaretPath(ids, index)`, pure): the first ID of
  the chain that the open hall indexes (`indexHall(hall).byId`, the
  hall's own ID included) gives its row path. An item's line selects
  the item; a line that is not an item (a comment inside an item)
  selects the enclosing item; the `gdHall` line and hall-level comments
  give `[]`, which clears the selection; a caret outside the hall gives
  `null`, and the hall asks for nothing, keeping its selection (answer
  5). `selectPath` then takes the nearest drawn ancestor, as on the
  hall page.
- **Held while typing:** the link gives the chain to the hall only on
  read text; a chain that changed while typing selects at the read,
  and the hall editor asks again with each new hall while the source
  leads, which is exactly each read (063's answer 5).
- **Reveal:** `selectPath` without `pageInset`: the visual panel scrolls
  just enough, the item and its label 16 px clear, above a docked
  panel. No focus taken, nothing announced.
- **`revealSelected`** (answer 6): a request for a chain the hall has
  not asked for before also reveals the item when it is already
  selected. Without it, a caret coming to the item the drawing already
  selects, after the author scrolled the visual panel away, would
  scroll nothing at all, where today the block follow scrolls to the
  hall. A request made again only because the hall changed (a read)
  does not, so a pause in typing never pulls the panel back.

### 4. Who leads, and the block follow

**Origin.** As on the hall page, the link follows the panel that led
last: `onFocus` on each `<section>` (React's focus events bubble out of
the node view's portal), and `caretMoved` itself, which makes the source
lead whatever the order of events. The source leading ends the
drawing's lead on the selection, so typing never draws the caret back
to the selected tag; the drawing leading ends the source's requests. A
selection the source asked for is reported while the source leads and
is never echoed into a caret move.

**Visual → source.** The block follow never fires from the hall editor
(`insideHallControls`, and `hasFocus`), and the link's `cursor` fires
only from it; they cannot both act on one change.

**Source → visual.** In `onCaretNode`, while linked:

```ts
// True when the chain is in an item of an open hall that is shown.
if (!link.caretMoved(ids)) ids.some((id) => revealRitualNode(editor, id));
```

`caretMoved` answers true when an open hall's ID stands in the chain
after its first ID (the caret is in one of its items) and that hall's
editor is drawn (its node view has a height). Then the item reveal
does all the scrolling, just enough, inside `.editor`. The hall's own
line (`[]`), lines outside open halls, closed halls, and a hall whose
editor is not drawn (a footnote's hidden canonical body) keep today's
follow unchanged.

### 5. The channel: React context over SemanticEditor state

`src/doc/ritualHallLink.ts` (doc code: no app imports, no JSX):

```ts
/** The source caret's chain, innermost first, on read text. */
export interface RitualHallCaret {
  ids: readonly string[];
  /** Increments for each move, so a repeat is a new request. */
  key: number;
}

/** The ritual editor's side of the link, given to open hall editors. */
export interface RitualHallLink {
  /** Split view: both panels are showing. */
  linked: boolean;
  /** While the source leads, on read text; else null. */
  caret: RitualHallCaret | null;
  /** An open hall editor: on mount; the result on unmount. */
  open(hallId: string, shown: () => boolean): () => void;
  /** The open hall's selection, on mount and whenever it changes. */
  selected(hallId: string, id: string | null): void;
}

export const RitualHallLinkContext =
  createContext<RitualHallLink | null>(null);

export function hallCaretPath(
  ids: readonly string[],
  index: HallIndex,
): readonly number[] | null;

/** GdHallAtomEditor's half: its `selectPath` and `onSelectionChange`. */
export function useLinkedHall(
  hall: HallElement,
  shown: () => boolean,
): Pick<GdHallEditorProps, "selectPath" | "onSelectionChange">;
```

SemanticEditor's half is `useRitualHallLink`
(`src/app/doc/[_id]/edit/semantic/useRitualHallLink.ts`), given
`displayMode` and the source state. It keeps the selection, the caret
and the lead in state (the lead mirrored in a ref for callbacks), the
open halls in a ref, and returns the memoised link, `cursor`, `marked`,
the section focus handlers and `caretMoved`. SemanticEditor wraps
`<EditorContent>` in `<RitualHallLinkContext value={link}>` (React
19.3), passes `cursor` to `RitualSourceEditor` and `data-linked-caret`
to the source section. `GdHallAtomEditor` passes `useLinkedHall`'s
result to `GdHallEditor`; without a provider (its own tests, any other
host) it returns nothing and behaves as today.

Why this channel:

- **Context reaches the node view** (checked in the installed
  `@tiptap/react`), footnote projections included, and its absence is
  the off switch.
- **State is enough.** The caret's chain changes on a click or an arrow
  key that crosses a line; SemanticEditor already renders for every
  keystroke in the source and every hall edit, and its children bail
  out (the node views are portals with stable elements). Only open
  hall editors consume the context. An external store would save one
  SemanticEditor render per chain change at the cost of a subscription
  by hand; it is kept only if the browser check measures a cost (arrow
  keys through the Neophyte hall's lines).
- **Not editor storage or an emitter on the Tiptap editor**: storage
  belongs to an extension in `ritualTiptapClientExtensions`, which the
  footnote editors share; an emitter keyed by the owner editor (as
  `ritualEditorOwner`'s WeakMap) needs the same subscription by hand,
  outlives the editor's React lifetime, and is not off by default in
  tests.
- **Requests carry their hall**, as 063's do: `useLinkedHall` builds
  `{ path, hall, revealSelected }` from the caret and the hall it
  renders with, so `GdHallEditor`'s own check (`selectPath.hall ===
  committed.hall`) refuses a request for any other hall.

### 6. Lifetimes and the odd cases

- **Hall closes** (Done, Escape, a failure, the node view going):
  `open`'s cleanup; when its last instance closes, its selection is
  forgotten, so no cursor and no mark remain.
- **Visual:** the link stays provided (`linked` false): no cursor, no
  requests, reports kept. **Split from Visual:** the drawing leads
  (decision 2).
- **Source, a visual issue:** the visual panel unmounts, and the hall
  editor closes as above.
- **Dirty, error, conflict, `ritual-text`:** no cursor, no mark, no
  caret given to the hall; a conflict reads only through Apply source.
- **Locked or reloaded editor:** its content is cleared, and the halls
  with it.
- **Strict mode:** `open` is an effect with a cleanup and counts its
  instances; `revealSelected`'s memory of the last key asked is written
  in an effect, not during render; `cursor` is already applied per view
  instance.
- **Two halls open at once:** each resolves the chain against itself; a
  caret in one asks nothing of the other, which keeps its selection.
  The cursor follows the hall the author last selected in.
- **Footnote projections:** a hall in a footnote's projected editor
  consumes the same context; IDs are the canonical document's.
- **IDs in several places:** IDs are unique in the document; only the
  commented-out header lines of decision 1 can repeat one, and the
  first header wins.

### 7. API changes

- `GdHallEditor`: `HallSelectionRequest.revealSelected?: boolean`. With
  it, a request for the node already selected still scrolls it into
  view (just enough, as any asked-for reveal), by setting the pending
  reveal as if from no selection and rendering once more. The hall page
  does not pass it and is unchanged.
- The `ritualAtom` node view (`tiptapRitualClient.ts`) gets an `update`
  option: the same node object updates nothing (as now), a node with
  another `attrs.tag` is refused (ProseMirror makes a new view), any
  other is drawn with its new props (as now). Atoms of one tag update
  exactly as before; only a view's re-use across tags goes. Tested with
  a read that removes the atom before an open hall.
- `GdHallAtomEditor`: `useLinkedHall(hall, shown)` spread onto
  `GdHallEditor`, `shown` reading its node view's height.
- `SemanticEditor`: the hook, the provider, `cursor`, the section focus
  handlers, `data-linked-caret`, the new `onCaretNode` body.
- `RitualSourceEditor`, `revealRitualNode`, `useHallSelectionLink`,
  `hallSourceMap`: unchanged.
- The compiler identity files (`semantic.ts`, `semanticCompilerImpl.ts`,
  `ritualNodeIds.ts`), `src/components` and `packages/magick-data`:
  untouched.

### 8. What is reused, and what is not

- **Reused as they are:** `RitualSourceEditor`'s `cursor` and
  `centredScrollTop`; `GdHallEditor`'s `onSelectionChange`,
  `selectPath`, contained reveal and `drawnRect` (through
  `selectPath`, no `pageInset`); `indexHall`; `ritualPugLineOfId` and
  the chain behind `onCaretNode`; 063's layout rule.
- **Moved and shared:** the two style-B rules leave
  `hallPlayground.module.css` for `src/doc/linkedCaret.module.css`
  (class `.panel`, the same selectors on `[data-linked-caret]`), which
  both source panels add to their class. One definition of the mark;
  the hall page's markup changes only its `className`.
- **Not reused:** `useHallSelectionLink` is built round a hall-only
  source (`HallEntry`, the map, typing the page reads itself, the
  page-scrolling `pageInset` beside a sticky panel) in one component.
  Here the source is a whole ritual whose read state SemanticEditor
  owns, the IDs are in the text, and the two halves live on either side
  of a node view. Sharing it would mean a hook with two modes and no
  common path; it stays in `src/app/gd/halls/editor`. `hallSourceMap`
  is not needed (decision 1).

### 9. Accessibility

As 063: a selection from the source is not announced, a caret moved
from the drawing is silent, and neither takes the focus.

### 10. Tests and checks

Per-file 95/90 coverage (`vitest.config.mts`): add
`src/doc/ritualHallLink.ts` and
`src/app/doc/[[]_id]/edit/semantic/useRitualHallLink.ts`; keep
`GdHallEditor.tsx` and `GdHallAtomEditor.tsx`, already listed.

- **`ritualHallLink.test.tsx`:** `hallCaretPath` for an item, a nested
  item (innermost wins), a comment line in an item, the `gdHall` line
  (`[]`), a chain outside the hall and an empty chain (`null`);
  `useLinkedHall` with and without a provider: `open` on mount and its
  cleanup, `selected`, a request per new caret with `revealSelected`,
  again for a new hall without it, nothing outside the hall, nothing
  without a caret.
- **`useRitualHallLink.test.ts`** (`renderHook`, a printed ritual with
  the Neophyte hall in a `note`): the cursor on an item's tag column;
  again for a new `source.text`; none while dirty, in conflict, in
  `ritual-text`, not linked, for an ID not in the text, or once the
  source leads; Visual → Split giving it again, also after the source
  had led; forgotten when the hall closes; `marked` for each condition;
  `caretMoved`'s answer (an item of a shown open hall, the hall's own
  line, outside, a hall not shown) and the caret given to the hall only
  on read text while the source leads.
- **`GdHallEditor.test.tsx`:** `revealSelected` scrolls an already
  selected node out of view in a scroller, and nothing when it is in
  view; without it, nothing (063's case unchanged).
- **`GdHallAtomEditor.test.tsx`:** with a provider, a selection in the
  drawing reaches `selected` with the hall's ID; a caret selects the
  item, `[]` clears, a caret outside keeps the selection; `open` on
  mount and its cleanup on Done. The node view keeps an open hall's
  editor through a `setContent` that removes the atom before it.
  Without a provider the existing tests stand.
- **`SemanticEditor.test.tsx`** (the hall test's setup, split view, the
  Neophyte hall). Its source mock gains `data-cursor` (when
  `cursor.source === value`) and captures `onCaretNode` for the test to
  call, as `HallPlayground.test.tsx`'s does; `ritualPanelFollow` is
  mocked to spy on `revealRitualNode`. Tab in the drawing gives the
  cursor of the item's line and `data-linked-caret`, the focus staying
  in the drawing; a nudge gives it again in the reprinted text; a chain
  in another item selects it, without the block follow; the `gdHall`
  line clears the selection and calls the follow; a chain outside the
  hall keeps the selection and calls the follow; with the hall closed
  the follow runs and opens nothing; Tab → Visual → Split gives the
  cursor again, and so does a source-led selection → Visual → Split;
  typing an attribute keeps the hall editor open; Done takes the mark
  away.

**Browser check**, headless Chromium over CDP against a production
build of the tip (`next build --webpack`, `next start -H 127.0.0.1` on a
free port), with a temporary `.env.local` holding only the local
database and login lines, the 127.0.0.1 URLs, a throwaway auth secret
and placeholder Google values (deleted afterwards), the Creator test
login, at 1,440 × 900, on a test copy of a ritual with a hall:

- Edit hall; a click and Tab in the drawing put the caret on each
  item's tag with the mark; the focus stays in the drawing; the window
  never scrolls.
- A click and the arrow keys in the source select each line's item;
  an item below the visual panel's fold scrolls the panel just enough
  to show it with its label; the `gdHall` line clears the selection; a
  ritual line outside keeps it.
- Typing an attribute keeps the hall editor open and selects the item
  again at the read, without scrolling the panel back.
- Tab → Visual → Split puts the caret back on the item.
- Arrow keys through the hall's lines: the time from key to selection
  drawn (decision 5's measurement).

Screenshots under `.mockups/ritual-hall/` in the worktree (not
committed).

## Commits and gates

1. `docs(plan): Plan ritual hall selection link`: this plan, and plan
   000's TODO pointing here.
2. `feat(gd): Follow hall selection in ritual source`: the context,
   `useLinkedHall`'s `onSelectionChange` half, `useRitualHallLink`'s
   cursor, mark, lead and layout; `linkedCaret.module.css` (the hall
   page's rules moved); tests.
3. `feat(gd): Select hall items from ritual caret`: `hallCaretPath`,
   the caret, `useLinkedHall`'s `selectPath`, `revealSelected`, the
   node view's `update`, the new `onCaretNode`; tests.

Each gated alone in a clean `git archive` export under `~/.cache/gates/`
(install, check, typecheck, test:coverage, build), with nvm's Node 24;
the tip also runs `loom check`, the `magick-data` smoke test and
`check:turbopack`. The compiler identity files, `src/components` and
`packages/magick-data` stay byte-identical; the reader boundary test
passes.

## Risks

- **Context through node views** depends on Tiptap rendering them as
  portals under `EditorContent` (3.31.3 does). A Tiptap upgrade that
  renders them in separate roots would turn the link off silently; the
  SemanticEditor tests, which use the real `EditorContent`, would fail.
- **A read that recreates the hall's node view** would still close the
  hall editor; the `update` option removes the cross-tag case, and a
  test types an attribute with the hall open.
- **The lead is a heuristic**, as on the hall page (a click on the page
  outside both panels leaves the last lead).
- **A stale header scan** for commented-out lines (decision 1).

## Out of scope

- Linking a tag typed without an ID before a reprint (keeping
  `parseRitualPugWithLocations` from `applySource` would do it, at the
  cost of a second map; not worth it while a nudge fixes it).
- The visual panel's ProseMirror caret, other atoms, and `follow` for
  closed halls: unchanged.
- `revealSelected` on the hall page.
- Real phones and Safari: no link there (Gadi's decision 4).
