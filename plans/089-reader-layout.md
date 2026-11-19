# Ritual reader: reading column, side rails and rubric directions — 18 November 2026

Status: decisions settled with Gadi on 18 November 2026 from the mock-up
sheets (width option D, marking option D); the design reviewed
adversarially by Fable on 18 November 2026 (see "Review"); the
continuation rule (decision 3) settled with Gadi the same day; **built
on 18 November 2026** on `gate/reader-layout` (see "Build" and
"Commits"). Read
[current status](000-current-status.md) first. The other findings of the
same UX pass are deferred and listed under "Deferred".

## Background

The reader (`/doc/[_id]`, public and private, and the built-in
`/doc/neophyte`, `/doc/zelator`, `/doc/theoricus`) was built for phones.

- `src/app/doc/[_id]/DocRender.tsx` (`DocView`) draws the variables, the
  ritual body (`blocks.jsx` `Render`) and a fixed MUI `SpeedDial` holding
  Jump to Next/Back, Halls, Contents and Zoom. The body is the full width
  of the page: at 1,440 px its text column is 1,393 px, about 200
  characters a line. The page's `h1` is drawn outside `DocView` by
  `(reader)/doc/[_id]/page.tsx`, `DocPageShell.tsx` and
  `PrivateRitualReader.tsx`, with no side padding.
- The ritual editor's preview also renders `DocRender`
  (`SqlDocEdit.tsx`, `hallNavigation={false}`), in a half-width pane
  with its own scroller.
- `src/doc/ritualBlocks/Frames.tsx` `TaskFrame`/`TaskBody` and
  `frames.module.css` are shared by the reader and the visual editor
  (`renderForEditing.tsx`, audience `"author"`). Speech gets generated
  curly quotes at 120% with a hanging indent; actions get italics and
  generated asterisks. Every task is a `Paper` bubble. Only `TaskBody`
  knows the kind; `TaskFrame` does not.
- `blocks.jsx:196` sets `samePreviousRole` from the role alone; the frame
  then drops the role line and pulls itself up. In the Neophyte 109 of
  411 tasks follow their own role, and 66 of those change kind (47
  action → speech, 19 speech → action); Zelator has 42 such, Theoricus 45.
- The floating button's number is `nextPos − currentPos`
  (`DocRender.tsx:518-568`): a difference of top-level child indexes, so
  it counts notes, titles and breaks too; it is 0 until the first scroll
  and is not recomputed on a role change, zoom or a `<details>` toggle.
  Jump Back state is a ref (`jumped`), not state.
- The app bar is fixed and hides on scroll down (`MyAppBar.tsx`,
  `<html data-app-bar-hidden>`). Under a Hebrew interface MUI's RTL
  plugin flips `sx` margins (`LocaleTheme.tsx`), even inside the
  ritual body's `dir="ltr"`.
- `pnpm i18n:check` runs `lingui check sync`, so new messages fail the
  gate until extracted.
- Nothing outside the reader depends on the quotes, asterisks or bubble
  DOM: they are pseudo-elements, and offline bundles, search and the
  semantic code read rows, not reader HTML (verified in review).

## Decisions

### 1. Directions are rubrics, not bubbles (marking option D)

- Speech stays in its bubble, upright, **without quote marks**; the
  hanging indent and its margin go with them (`frames.module.css` 30-32,
  the inline-slot rules, and the empty-task allowance in
  `editing.module.css`).
- An action is drawn on the surface, not in a `Paper`: italic, in a
  rubric colour (light `#8a3324`, about 6.8:1 on the surface; dark a
  lighter red, ≥ 4.5:1 on both `ritual.surface` and the self tint), with
  a 3 px inline-start rule in the officer's colour. **No asterisks.**
- The reader's own actions keep the self offset and get the green rule
  and `ritual.selfAction`, a light tint of `ritual.self`.
- New palette tokens in `theme.ts`: `ritual.rubric`, `ritual.selfAction`,
  light and dark (plan 076's pattern).
- **Frame contract.** `TaskFrame` takes `kind: "say" | "do"`
  (`blocks.jsx` and `renderForEditing.tsx` pass it). It keeps one root
  element for both kinds, so switching kind in the editor does not
  remount the content slot; keeps `position: relative` (the line number
  is absolute), `data-ritual-frame="task"`, `data-audience`, and the
  `.say`/`.do` classes the tests read. `--ritual-role` moves from the
  name span to the frame root, so the rule can use it.
- **Rule colour for groups**: `all`, `all-officers`, `all-except` and
  multi-role tasks use a neutral rule (`text.secondary`), not the first
  role's colour.
- **The self offset moves from `sx` into the CSS module** as physical
  left/right, matching the ritual body's fixed `ltr`, so the RTL plugin
  cannot flip it.
- **The line number** goes to `text.disabled` contrast against the
  surface and keeps clear of the text on rows without a role line
  (deferred item 2, pulled in: rubrics make the collision worse).
- **Screen readers**: the action row carries `data-kind-label`, a
  Lingui message ("Direction"), shown by visually hidden generated
  content, so it is announced but never copied, needs no `lang`, and
  stays out of the editor's editable content.
- Role line and lamen sizes for directions scale with the text-size
  control (`em`, and the lamen sized by CSS rather than `height={25}`).
- **The visual editor follows**: the frames are shared on purpose.

### 2. A reading column, then side rails (width option D)

- **One shell.** A `ReaderShell` lays out title, column and rails in one
  grid; the three title sites pass the `h1` in as a slot. The surface
  colour fills the page behind it, on phones too (the white band under
  the app bar goes).
- **Column**: `max-width: 46rem` (≈ 70 characters at 16 px) everywhere,
  16 px gutters.
- **Rails from 1,200 px**: grid `15rem | minmax(0, 46rem) | 15rem`,
  centred; sticky below the app bar (`top` follows `--app-bar` and
  `data-app-bar-hidden`), each with a max height and its own scroll.
  The hall page's rail starts at 900 px; the reader needs both rails
  and the column, so 1,200 px.
  - left: **Contents**, `ritualContents` entries (titles, halls
    indented). Entries are ritual text: `dir="auto"`, `lang=""`. The
    current section comes from the existing scroll handler through a
    pure function over title positions, by index (title ids repeat).
    A click scrolls with `history.replaceState`, not `location.hash =`,
    so contents jumps do not pile up history.
  - right: **Reading as** (the `myRole` select), **Your next line**,
    **Halls** when the ritual has any, **Text size**.
  - From 1,200 px the `SpeedDial` is hidden by CSS; below it, nothing
    changes except the column.
- **One DOM, placed by CSS.** Each control is rendered once and moved
  between the top of the column and the rail by the grid, never chosen
  with `useMediaQuery`: the server, the prerendered built-in rituals and
  `ShowVar`'s local debounced state all need a single instance.
- **When `myRole` is absent or hidden** (an author variable), "Reading
  as" and "Your next line" are not shown, as the floating button's
  count is meaningless then.
- **"Your next line"** counts **tasks** (not top-level children) between
  the reading position and the reader's next task; computed on mount,
  scroll, role change, text-size change and `toggle` events; positions
  from `getBoundingClientRect`, since the grid may become an offset
  parent. After the reader's last task it says so ("No more lines") and
  the jump is disabled. Jump Back becomes state, so both the rail and
  the floating button re-render. The floating button shows the same
  number.
- **Anchors**: title and hall anchors get `scroll-margin-top` for the
  app bar.
- **RTL**: logical properties for the rails; the ritual body keeps its
  own `lang=""`/`dir="ltr"`.
- **Editor preview**: `DocView` takes `chrome` (default on);
  `SqlDocEdit` passes `false`, which drops the shell (no column, no
  rails) and keeps today's floating button at every width, since the
  pane's width is not the viewport's.

### 3. A direction after its own role's speech tucks under it

The rubric layout makes the role-only `samePreviousRole` rule leave
directions without a role line beside bubbles without one. Two rules,
mocked at phone width:

1. The role line returns whenever the kind changes (same role **and**
   same kind hides it).
2. Same role still hides it, and a following direction tucks under the
   bubble (tight gap, indented), reading as the rest of that officer's
   turn.

**Settled: 2** (Gadi, 18 November 2026). It groups one officer's turn the way chat apps
do, and saves about 66 role lines in the Neophyte; the tuck and the
officer-coloured rule carry who it is. (1) is the fallback if a
tucked direction proves ambiguous for low-contrast role colours before
deferred item 1 is done.

## Stages

Each stage is one or more gated commits on `gate/reader-layout`, each
with its Lingui extraction, Hebrew entries, `pnpm i18n:check` and the
documentation screenshots it changes (AGENTS.md).

**A. Rubric directions.** `Frames.tsx`, `frames.module.css`,
`blocks.jsx`, `renderForEditing.tsx`, `editing.module.css`, `theme.ts`,
`roles.tsx` (lamen sizing). Decision 1 and 3. Tests: frame contract
(kind, root kept across kinds, data attributes), group rule colour,
continuation rule, the hidden kind label; rubric contrast computed for
light and dark, including on the self tint. Screenshots: `reader-phone`,
`editor-visual`, `editor-phone`, `editor-split`.

**B. Reader shell and column.** `ReaderShell`, the three title sites,
`DocView` (`chrome`), `SqlDocEdit`. Anchor scroll margins. Screenshot:
`reader-phone`.

**C. Rails and the next-line count.** Contents with section tracking,
reading as, next line, halls, text size; the `SpeedDial` hidden from
1,200 px; the count's new unit and states. Tests: the section and
count functions (pure), the hidden-`myRole` case, and that controls
render once (jsdom ignores media queries, so `DocRender.halls.test.tsx`
asserts on single instances, not visibility). Help: the temples page's
"the floating button's Halls" (`help/temples/page.tsx:508`) gains the
rail, with its Hebrew entry. Consider a `reader-desktop` shot for it.

## Verification

Phone (375 × 812), 1,000 px and desktop (1,440 × 900), light and dark,
English and Hebrew interface, Neophyte and a private synthetic ritual:
no horizontal scroll; the column's measure; rails sticky under the app
bar as it hides and returns; contents highlight and jumps (no history
entries); `#hall-N` links on load; the next-line count against a hand
count, after a role change and at the end; editor visual mode and
preview; print in light, where the distinction rests on italics and
the rule.

## Review

Fable 5.2 (high) reviewed the first draft on 18 November 2026 against
the code. Taken in: the continuation rule (decision 3), stage D folded
into A–C because `i18n:check` and the screenshot rule gate each stage,
the frame contract, the next-line unit and states, one DOM placed by
CSS, the editor preview's `chrome={false}`, app-bar offsets and anchor
margins, the RTL flip of `sx` margins, the generated kind label, the
help copy, group rule colours and the line number. Verified correct:
nothing outside the reader reads the quotes, asterisks or bubbles; the
screenshot list; light rubric contrast; module CSS beats MUI's layered
styles; the editor's selection outline and footnote collection do not
depend on `Paper`.

## Deferred (same UX pass, 18 November 2026)

1. Role-name contrast in light (Member `#ccc`, Hegemon `#aaa`,
   Candidate `#fcf`, Dadouchos `#cc5` on white), and the same colours
   as rules on the beige surface: darker light variants.
2. Floating button: accessible name ("SpeedDial basic example") and
   untranslated tooltips; Jump to Next aims the cue at the screen's
   bottom edge. (Its stray `))` child went in stage C: it was also
   indexed as the built-in rituals' search prose.)
3. Text size not saved across reloads.
4. A pinned "Reading as …" chip below 1,200 px.
5. Rehearsal mode (hide my lines; my lines plus their cues).
6. Screen wake lock while reading; linkable line numbers.
7. The editor preview (`chrome={false}`) scrolls in its own pane, but
   the count measures against the window and Jump back scrolls the
   window: both stale or inert there (Jump back was already).
8. The variables panel in the rail has no "Reading as" label; the
   "My role" select's own label stands in.
9. The public `/doc/*` search prose is extracted from `DocRender.tsx`'s
   JSX text ("Ritual not found", "More Variables"), so any wording
   change in the reader needs a `search:publish`; the reader's interface
   text probably should not be indexed at all.

## Build (18 November 2026)

Stages A, B and C as planned, each a gated commit (see "Commits").
Implementation ran in Opus 5.5 subagents at high effort from briefs
written from this plan; the plan's review and the final review in Fable
5.2 at high.

**How each stage was checked.** A CI-equivalent gate in the worktree
(Node 24, the CI placeholder environment): `biome check`, `typecheck`,
`test:coverage`, `i18n:check`, `build` and `loom check`. Heavy load from
other sessions timed out unrelated tests twice (24 and 2 files); each
passed when re-run alone. Pages were looked at in the worktree's own dev
server (127.0.0.1, CI placeholder settings, the built-in Neophyte),
through headless Chromium at 375/390, 1,100, 1,240 and 1,440 px, light
and dark. Docs screenshots came from `magickli-docs-capture`.

- *A:* the four reader and editor shots came out byte-identical (they
  show only the ritual's opening title and hall).
- *B:* `reader-phone` regenerated (the title's gutters and surface).
- *C:* `reader-phone` again (the floating button's count, now in tasks)
  and the new `reader-desktop`, shown on the temples help page with a
  clause on the side panel's Halls.

**Deviations.** Speech bubbles left `Paper` too, not only directions,
so both kinds share one element (the bubble's look moved to CSS). The
reader's own directions use `success.main` for their rule rather than a
new token. A same-role run tucks every direction after its first speech
(say, do, do), not only the one straight after it. When `myRole` is
absent or hidden the floating button's jump is disabled rather than
inert. Contents and table-of-contents jumps (titles and halls) replace
the address's hash instead of adding history entries; `revealHall` has a
replace mode for them. The reader no longer writes `ref` and `forMe`
onto ritual rows (the old count's bookkeeping); `forMe` had reached
saved content before.

**Final review.** Fable 5.2 (high) reviewed the branch with stage C
uncommitted: no critical or high findings. Fixed before committing C:
hall jumps adding history; `replaceState` keeping Next's `__NA` state
(the router would then drop the hash); `aria-live` on the count; a gap
under the title in short rituals with the rails (`auto 1fr` rows); the
say, do, do indent; an empty Contents card; no current section at the
top; "More Variables" not re-measuring; Jump back hiding Jump to next in
the rail; tests for the measuring wiring (role change, scroll, closed
summaries, footnote tasks, `aria-current`). Left: items 7 and 8 under
"Deferred".

**Search.** Stage C changes the public search catalogue (the temples
help copy and the built-in rituals' prose), so its commit carries the
republished embeddings (`search:publish
gemini-embedding-2-768-search-v1`, run by Gadi on 19 November after
the branch was rebased onto main's sigil publish: 15 rows replaced,
3,079 in all). The full gate passed on that tree: 13,700 tests,
build and `loom check`.

## Commits

| Commit | Change |
| --- | --- |
| 361f62da | The plan |
| 2dc29a51 | Stage A: rubric directions |
| ee3bccd7 | Stage B: the reader shell and reading column |
| 582f81b6 | Stage C: rails, the next-line count, help and search |
| (the next) | This plan brought up to date |

## Mock-ups

Throwaway HTML from the session, not committed: four width options at
1,440 px, four marking options and two continuation rules at 375 px,
using an excerpt of the built-in Neophyte.
