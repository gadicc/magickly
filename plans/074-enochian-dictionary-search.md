# English search in the Enochian dictionary — 10 November 2026

Status: options shown to Gadi as mock-ups and settled with him on
10 November 2026 (decisions 1 to 4, 10 and 11's refresh). Spiked the
same day (see "The spike"). Adversarially reviewed (Fable) and revised
the same day (see "The review"). Gadi said to build it, and accepted
decision 13's description as drafted, the same day. Built on
`gate/enochian-dictionary-search` the same day, every commit gated,
and the branch reviewed by Fable and fixed (see "The build"). Read
[current status](000-current-status.md) first.

This plan takes up the TODO that [plan 071](071-on-site-search.md)
left in current status (stage 5, answer 3): English search in the
dictionary, with a revamp of its UI and UX. "enochian translator" and
"enochian dictionary" are search targets of plan 071, and
`/enochian/dictionary` has no Search Console impressions. A neural
Enochian translator is a long-term goal (current status, "Long-term
goals"). It is out of scope here, but decision 5 leaves room for it.

## What exists

- **The page.** `src/app/enochian/dictionary/page.tsx` renders the
  client component `dictionary.tsx` and the server text
  `DictionaryText.tsx` (plan 071, decision 5). The component has two
  boxes holding one query: Latin letters on the left, the same text in
  the Enochian font, right to left, on the right. Every keystroke is
  upper-cased, which moves the caret to the end. The 1,911 keys are
  filtered with `x.match(text)`, which compiles the query as a regular
  expression, so typing `(` throws. Each match is a grey row (word,
  script) with no meaning. Tapping a word, or typing it whole, opens a
  black bar fixed to the foot of the screen with its pronunciation,
  meanings and gematria. The bar can't be closed, and nothing is kept in
  the URL. Colours are hard-coded (`white`, `#aaa`, `#111`), so dark
  mode breaks.
- **The data.** `packages/magick-data/src/enochian/dictionary.json5`,
  typed by `dictionaryEntry.ts`. It has 1,911 words and 2,223 meanings:
  2,019 from *The Whole Enochian Dictionary* (WE), 199 from Schueler's
  *Enochian Magic: A Practical Manual* (EMPM), 4 from the Keys and 1 with
  an empty source. 1,669 words have one meaning. Meanings are free text
  in mixed case: 886 are all capitals, 592 contain a comma and 29 a
  semicolon. They also hold brackets, `/`, `?`, curly quotes, full stops
  and abbreviations ("in p. and presence").
  - WE puts the headword first and its context after ("kingdom, in thy
    kingdom"), and inverts articles ("GOVERNOR, THE").
  - Some meanings are not meanings. "meaning unknown" appears in several
    forms, and 48 words have nothing else. There are 91 "PART IN …"
    (pieces of names), 7 "var of …" (4 of them in the middle of a
    meaning), 3 "Name from …" and 27 bare numbers.
  - Seven keys are not plain capitals (`fatesged`, `GO (LE)`, `OBZa`,
    …). The letters C/K, I/Y/J and U/V/W are one Enochian letter each
    (`letters.json5`), and the keys use K 12 times, Y 29, J once and W
    once. U/V twins are separate entries (DIU and DIV, ULS and VLS, …).
- **The Keys.** `keyEntries.ts` resolves the Keys' words to dictionary
  keys on the server. It tries U/V and hyphens with `findWord`, and
  two-part splits with `findParts` (plan 073, decision 9). The Keys
  hold English per word, from Casaubon (1659), or from Crowley (1912)
  for the 51 words Casaubon lacks. That English is public domain; the
  split into words (260 rows) and the notes are ours, under CC BY 4.0.
  Key 19's rows repeat across 30 Aethyrs and two versions. The Keys page
  has no deep links: its accordion headers carry `key-N-header` ids, and
  the chosen Aethyr is local state (`keys.tsx`).
- **Today's server HTML** (production, 10 November 2026) is 570 KB, or
  30 KB gzipped. It has every word twice (Latin and script) and no
  meanings.
- **Next 16.4.3.** On a prerendered route, `useSearchParams` renders the
  client tree up to the nearest Suspense boundary in the browser only
  (`use-search-params.md`, "Prerendering"). `history.pushState` and
  `replaceState` keep the router in sync (`04-linking-and-navigating.md`).
  A `GET` route handler with `dynamic = "force-static"` is built once
  (`15-route-handlers.md`).
- **Site search** ([plan 070](070-site-search.md)) indexes the JSX text
  of a public page and of the components it imports by relative path
  (`scripts/search/prose.ts`). `src/search/semantic.test.ts` fails when
  that text changes without `pnpm search:publish`. Strings passed as
  expressions or attributes are not indexed. Plan 071 kept the trail's
  "›" out of the index that way.
- **Analytics** (`src/analytics/VercelInsights.tsx`) use the plain React
  components with the route taken from the pathname, and `insightsUrl`
  drops the query string. So `?q=` and `?w=` reach neither Vercel nor
  the route names.

## Mock-ups (10 November 2026)

Rendered at 390 px and 1280 px from real results by a prototype of the
ranking, and kept in the session notes rather than the repository:

1. One box or a switch: one box with grouped results (A), a direction
   switch (B), or one box with tabs (C).
2. Where the entry opens: in place (D), or two panes on desktop and a
   sheet on phones (E).
3. How to keep the right-to-left box: two boxes as today (F1), stacked
   (F2), F1 with an Enochian keypad (F3), or one box with the script
   shown inside it (F4).
4. Phones, then desktops, side by side with today's page.
5. How the keypad and the entry sheet share a phone screen.

## Decisions

1. **One query, two boxes, searched both ways (A with F1).** The Latin
   box takes English or Latin letters, as typed: no upper-casing, so the
   caret stays put. The Enochian box shows the same text in the script,
   right to left, upper-cased by CSS, and can be typed in. Arrow keys
   in the Enochian box move logically, which looks mirrored.
2. **An Enochian keypad (F3).** The Enochian box opens a keypad of the
   21 letters, each glyph above its Latin letter, with backspace and
   Done.
   - The letters come from `magick-data/enochian/letters`, laid out
     right to left, and each key is named for its letter ("Un, A").
   - The keypad cancels `mousedown` anywhere on it, gaps included, so
     the box keeps its focus and caret, and a key acts on click. (The
     draft said `pointerdown`; cancelling `mousedown` also covers a
     touch's compatibility events, and click keeps keys usable by
     assistive technology.) Clicking the box reopens a keypad closed
     with Esc.
   - On a coarse pointer the box gets `inputmode="none"` after
     hydration, so a phone's own keyboard stays down. A physical
     keyboard still types into both boxes.
3. **Where the entry opens (E).** At `md` and wider the page has two
   panes: the boxes and results on the left (about 440 px), the entry on
   the right. Below `md` the entry is a bottom sheet over the list. A
   swipe down, a tap outside, the close button or Back closes it, and
   the list keeps its scroll position. Under `prefers-reduced-motion`
   the sheet doesn't animate.
4. **One bottom panel at a time on phones.** Focusing the Enochian box
   raises the keypad. Tapping a word blurs the box, which lowers the
   keypad, and raises the sheet. The sheet is modal, so the box can't
   be focused while it is up; nothing else needs to close it. On desktop the keypad drops down under
   the boxes inside the left pane. Esc or a click outside closes it, and
   it never meets the entry.
5. **Search as a pure module** (`src/app/enochian/dictionary/search.ts`).
   It builds an index once. `searchDictionary(index, query)` returns
   `{ word, means, mentions, spelled }`: `word` is the exact headword or
   headwords, and the rest are ranked lists of hits. The UI only renders
   groups, so a later translator adds a group without touching the
   ranking.
   - **Text.** A meaning is lower-cased. Punctuation other than `;`,
     `,`, hyphens inside words and apostrophes becomes a space. The
     meaning splits into senses at `;`, and each sense into pieces at
     `,`. A piece made only of articles or possessives ("the", "a", "of
     the", "in the", "to the", "your", "i have") folds into the piece
     before it. Articles, "to" and possessives at the start of a piece
     are set aside for both comparison and length.
   - **Not meanings.** A meaning containing "meaning unknown", or one
     that is only "unknown", never matches. A piece beginning "part in", "var of" or "name from" is a
     reference: it ranks below every ordinary match. Other pieces of the
     same meaning stay ordinary ("earth, var of caosg" is still "earth").
   - **Words and stems.** Everything compares whole words, never
     substrings ("delight" never matches "light"). Exact words beat
     stems. Both sides go through one small stemmer: plurals (-s, -es,
     -ies→y), -ed, -ing and -eth, restoring a dropped e. The stemmer
     only touches words of four letters or more, and never strips a bare
     -d, -er, -ly or -est. So "angels" finds "angel", and "go" doesn't
     find "god".
   - **English tiers**, best first:
     - 0: a piece's words are the query's words.
     - 1: they are the same on stems ("angel" for "angels").
     - 2: a piece begins with the query's words, or their stems.
     - 3: the query's words appear together, in order, inside a piece.
     - 4: the same on stems, or a longer query's words all in one
       piece, in any order.
     References sit five tiers lower, below all of these. (The first
     draft had four tiers, with stems only in the last. The build moved
     a piece that is a form of the query into `means`, so "angels" lists
     MERIFRI ("angel") there.)
   - **Ties** break in this order: tier, which meaning (the first before
     later ones), which sense, which piece, the piece's length in words,
     how often the Keys use the word (more first), then the headword
     alphabetically. The Keys counts come from decision 9's builder and
     are passed in, so the module stays pure. Without them, "earth"
     puts CAOSGIN ("earth, var of caosg") above CAOSG, and "god" puts
     ASCHA above MAD.
   - **Each word once in English.** A word appears in `means` or
     `mentions`, never both, at its best hit, and its row shows the
     meaning that hit. `means` holds tiers 0–2; `mentions` holds tier 3
     and below. A word may also appear in `spelled`, which matches for a
     different reason.
   - **Stopwords** ("the", "a", "an", "of", "to", "in", "and", "or",
     "is") on their own get no English results. Inside a phrase they
     count ("son of light"). A number is a word, so "24" finds the
     numbers.
   - **Spellings** are matched as plain text, never as a regular
     expression, ignoring case. They fold the letters Enochian treats as
     one: K to C, Y and J to I, W and U to V. Hyphens, spaces and
     brackets are ignored. Exact words come first (U/V twins give two),
     then words that begin with the query, then words that contain it.
     Within each, shorter words first, then alphabetical order.
   - **Group order.** An exact headword is pinned as one row, labelled
     "Enochian word", above everything. Then come `means`, `mentions`
     and `spelled`. `spelled` leads only when the query has no English
     results. So "fire" pins FIRE ("woe") and then lists BITOM and PRGE,
     and "ol" lists the spellings. Empty groups are hidden. A filtered
     group shows 30 rows and then "Show all N".
6. **Rows carry a meaning.** Each row shows the word, its script, and the
   meaning that matched, or its first known meaning when there is no
   query. Words with no known meaning say "meaning unknown", dimmed. The
   matched words are bold (stopwords in a phrase are not). Rows are
   plain `div role="option"` elements, not MUI `ButtonBase`, because
   1,911 of them must hydrate; the combobox (decision 12) gives them
   their keys. A space separates a meaning from its source, so the
   row reads "light EMPM", not "lightEMPM".
7. **The server HTML holds the whole list with meanings.** The page stays
   prerendered. Its first render is the unfiltered list, all 1,911 rows
   with no cap, so search engines see "OLPRT … light". The list never
   calls `useSearchParams`. Filtering uses `useDeferredValue`, so typing
   stays responsive while the list catches up.
8. **Shareable links without losing the prerender.**
   - `?q=` holds the query, written with `replaceState` while typing.
     `?w=` holds the open word, URL-encoded and matched exactly, written
     with `pushState` when a word opens, with a marker in the history
     state.
   - Both are read through `useSyncExternalStore`, with an empty server
     snapshot, and on `popstate`. A shared link renders the full list
     first, then its query and entry.
   - Closing an entry (swipe, tap outside, close button) goes
     `history.back()` when the current entry carries our marker, once
     however often it is tapped. Otherwise, as on a cold `?w=` link, it
     removes `w` with `replaceState`, so it never leaves the site. A
     word opened from a cold `?w=` link replaces it, so one close is
     enough.
   - Closing keeps the query in the boxes, though the history entry it
     goes back to may hold an older one: a query still waiting on its
     pause is written before a word's entry is pushed, and after a close
     the boxes' query is written back.
   - The history state written is our marker alone. Next's patched
     `pushState` and `replaceState` then copy its internals in and sync
     its router (`useSearchParams`, the sign-in link's return URL); a
     state already carrying them (`__NA`) would skip that.
   - "Copy link" copies `/enochian/dictionary?w=WORD`, without `q`. The
     canonical stays `/enochian/dictionary` (`pageMetadata`).
9. **"In the Keys" in each entry, fetched when it opens.**
   - A force-static route handler, `src/app/enochian/dictionary/keys.json/route.ts`,
     serves a map from each dictionary word to where the Keys say it. It
     is built by `keyUses.ts` from `keys` and `keyEntries.ts`'s
     `findParts`, imported rather than moved. Built, it holds 612 words
     and 1,060 uses (141 KB of JSON). The spike's similar map was 22 KB
     gzipped. The entry fetches it once, the
     first time any entry opens.
   - Each use records the Key, the row and its English, and up to
     three rows of English on either side. (The draft also named the
     work each row's English comes from. The data doesn't record that
     per row, so the entry names the Key and links to it, where the
     sources are.)
     Unspoken rows and rows with no English are skipped.
   - Uses are deduplicated by (Key, row): a Key 19 row counts once, not
     once per Aethyr and version. A use in Key 19's Aethyr slot is
     recorded as the Aethyr's name, linked to that Aethyr.
   - A word found only as part of a split word (NOR and MOLAP in
     NORMOLAP) records the compound's row, labelled "in NORMOLAP".
   - The entry shows the first use, "and N more" (expandable), and a
     link (`InTheKeys.tsx`). The Keys page gains anchors read after
     hydration and on `hashchange` (`readAnchor` in `keys.tsx`; its
     accordions become controlled): `#key-N` opens that Key,
     `#key-N-word-R` also selects its word, and `#aethyr-N-word-R` opens
     Key 19 at that Aethyr and selects the word. (The draft named Aethyrs
     by name; the build uses the number, which the map already holds.)
   - Only the counts per word (a few KB) are passed to the page as a
     prop, for decision 5's tie-break. Built into the page, the full map
     would have added 147 KB raw and 25 KB gzipped to every load (the
     spike).
10. **Theme colours throughout.** No hard-coded colours. The page uses
    the MUI palette, so dark mode works. Both modes are checked for
    contrast. (The build found that the app has no dark mode:
    `src/theme.ts` is light only. The page is ready for one, and the
    browser check is in light mode only.)
11. **One search refresh, with the page.** UI chrome ("Means", "Show
    all", "Copy link", "In the Keys", the keypad's labels) is passed as
    string constants (`labels.ts`), not JSX text, so it stays out of site
    search's index. The draft put the text, the description and the
    refresh in the last stage. The build found that the old
    `dictionary.tsx` put "( )" into the index (the brackets around each
    meaning's source), so rewriting it changes the index whatever the
    labels do. The text, the description and the one refresh (Gadi
    agreed on 10 November 2026) therefore moved into stage 3, the page's
    commit. Until stages 4 and 5 land, the text on the gate branch
    describes the keypad and "In the Keys" ahead of them; the branch is
    released whole. `public/search-vectors` keeps only the file the
    manifest names.
12. **Accessibility.**
    - Both boxes are labelled. The Latin box is a combobox over the
      results, with `aria-activedescendant`, so ↑/↓ move through 1,911
      rows without 1,911 tab stops, and Enter opens one. The groups have
      headings.
    - A polite live region announces the number of results.
    - The sheet traps focus and returns it to where it was when it
      opened (MUI's modal). On desktop, focus stays in the list and the
      pane is labelled by the open word. Only the Latin box moves
      through the results; the Enochian box leaves the arrows to its
      caret.
    - The keypad's keys are buttons with names.
13. **The search description** (`src/seo/pages.ts`) names English lookup,
    the target of "enochian translator". It changes in stage 3, in the
    commit with the refresh. Gadi accepted the draft on 10 November
    2026; at 170 characters it broke the 160 that `src/seo/pages.test.ts`
    allows, so it shipped without "their" twice and "Enochian" before
    "script": "Look up Enochian words by English meaning or spelling:
    1,911 words with pronunciations, sources, gematria, the script, and
    where Dee's Keys use them."

## Out of scope

- A translator, neural or by rule (a long-term goal).
- Editing the dictionary's text: its capitals, WE's inversions, the
  entry `I`'s empty source (a TODO in current status).
- A page per word (`/enochian/dictionary/[word]`). Such pages might
  rank, but would be thin. Search Console can decide it later.

## Stages

Each stage is one gated commit on `gate/enochian-dictionary-search`.

1. **The plan** (this file).
2. **Search.** `search.ts` and its tests (decision 5); `keyUses.ts`,
   with `findWord` and `findParts` shared from `keyEntries.ts`, and its
   tests (decision 9's builder and counts). No UI change.
3. **The page.** Two boxes, rows with meanings, panes and sheet, URL
   state, theme colours, keyboard and focus; the page text, the search
   description and the search refresh (decisions 1, 3, 6–8 and 10–13).
4. **The keypad** (decisions 2 and 4).
5. **In the Keys.** The route handler, the entry section, and the Keys
   page's anchors (decision 9).
6. **The record.** The final review's fixes, this plan's build notes,
   and current status without the TODO.

## The spike — 10 November 2026

Run in a throwaway worktree at `671eaca1` with Node 24 and CI's
placeholder environment, then removed. The changes were rows with
meanings, URL state through the history API, and the Keys map as a prop.

| Measure | Result |
| --- | --- |
| The route in the build | Static (`○`) before and after |
| HTML today | 570 KB raw, 30 KB gzipped |
| Meanings added to the rows | +96 KB raw, +25 KB gzipped |
| The Keys map as a prop | +147 KB raw, +25 KB gzipped, in every load: 552 words, 942 uses |
| A keystroke filtering 1,911 rows to 1,227 (390 px, CPU 4×, median of 5) | 96 ms |
| A backspace restoring the full list | 160 ms |

- The HTML holds the meanings ("OLPRT … light"). The app bar's
  `useSearchParams` bails out only its own sign-in Suspense, and the
  whole list is in the HTML.
- A cold load of `?q=light&w=OLPRT` shows the query and the entry after
  hydration, with no hydration warnings. Typing rewrites `q` without new
  history entries, and opening a word adds one. Back closes the word and
  keeps the query, and a reload keeps the state.
- With `inputmode="none"` the box still focuses, keeps its caret and
  takes text. Headless Chromium can't show whether a phone's keyboard
  appears, and there is no Safari device, so iOS is untested.
- Surprises that changed the plan: the map's weight (decision 9 now
  fetches it), the caret jumping on upper-casing (decision 1), mirrored
  arrows in the right-to-left box (decision 1), and the backspace costing
  1.7 times the keystroke (`useDeferredValue`, decision 7).

## The review — 10 November 2026

Fable, adversarial, against the first draft. It found no blockers and
six major points, all taken; I checked each against the code and data:

1. **A headword led over English.** "fire" put FIRE ("woe") above BITOM
   and PRGE; "man" and "not" behaved the same. Now the headword is
   pinned as one row (decision 5).
2. **Inflections ran one way and too far.** "go" found 82 Gods through
   "-d", and "angels" found 11 rows to "angel"'s 251. Now one stemmer
   works on both sides, with limits (decision 5).
3. **The tie-break contradicted the tests.** "god" sorted ASCHA first,
   and "earth" put a variant above CAOSG. The Keys counts now break
   ties.
4. **The spec was loose:** prefix by word or by character, folded
   articles, "once" across groups, punctuation, "var of" in the middle
   of a meaning, unknown-only words, numbers. Each is now stated.
5. **The search refresh.** JSX text in the page's components is indexed,
   so every stage that added any would have needed its own refresh. UI
   chrome is now constants, with one refresh at the end (decision 11).
6. **The Keys map:** split words, Key 19 counted up to 60 times, the
   Aethyr slot, words Casaubon lacks, the anchors, and the payload. All
   are in decision 9.

Minor points taken: C/K, I/Y/J and U/V/W folding and the odd keys;
history details; accessibility (combobox, live count, keypad focus,
`inputmode` after hydration, reduced motion); the search description;
plain-button rows; and tests. One finding was refuted: `?q=` causes no
spurious analytics routes, because the app passes the pathname itself
and drops query strings (see "What exists").

## The build — 10 November 2026

Built in this order, each stage a commit on
`gate/enochian-dictionary-search` from `main` at `3c305c78`, then
rebased the same day onto `4cedc473` (plan 075's geomancy text), by Opus 5.5
(reasoning high), with Fable 5.2 (reasoning high) reviewing. Where the
build departed from the plan, the decision above says so in
parentheses: the fifth tier for forms (5), the Keys map's size and the
uses' sources (9), no dark mode (10), the refresh moved into stage 3
(11), the anchors by number (9), and the description shortened to 160
characters (13).

**The search refresh** (stage 3) ran `pnpm search:publish
gemini-embedding-2-768-search-v1` with only `AI_GATEWAY_API_KEY` taken
from the main checkout's environment. The worktree had no embedding
cache, so it embedded all 3,018 passages (236,780 tokens), not just the
changed ones: a few cents. The rebase onto plan 075, which had
refreshed the index for its own text, conflicted only there; the stage
3 commit was republished from main's index, embedding 20 passages
(2,714 tokens) from this worktree's cache. The manifest names
`gemini-embedding-2-768-search-v1-d53330e26464.bin`, the only file left
in `public/search-vectors`.

**Gates** (a clean worktree on /home with Node 24 and CI's placeholder
environment: frozen install, `loom init` with no diff, `loom check` and
`--production`, `pnpm check`, typecheck, `test:coverage`, `build`). The
machine's load from other sessions ran at 30 to 50.

Before the rebase, from `3c305c78`: `a69964eb`, `e4b97458`,
`1aeecc0e` and `2a2e5c95` passed; `e973cb53` passed after one re-run of
5 timeouts outside this change; stage 6's first version failed coverage
on an unhandled error, the Keys anchor's word-scroll timer firing after
teardown, so the page now clears its pending scrolls on unmount, and
its second version passed. After the rebase onto `4cedc473`:

| Commit | Result |
| --- | --- |
| e5b1e579 | All pass (7,981 tests) |
| 97ee7e83 | All pass (8,009 tests) |
| 02b73697 | All pass (8,022 tests) |
| 55bfd020 | All pass (8,025 tests) |
| 2678c80b | All pass (8,030 tests) |
| Stage 6 (this) | All pass (8,041 tests), smoke and Turbopack too; the build lists `/enochian/dictionary` and `/enochian/dictionary/keys.json` as static. Only this record changed after the gate |

**The final review** (Fable 5.2, reasoning high, fresh, on `main..2a2e5c95`, before the rebase)
found no blockers and one major. All are fixed in stage 6 with tests,
except where noted:

1. Closing an entry dropped a query typed since it opened, or typed in
   the 300 ms before it (decision 8 now says how it is kept).
2. Our history writes carried Next's `__NA`, so its router never saw
   `q` or `w`, and the sign-in link's return URL went stale (decision 8).
3. A double close went back twice and left the page.
4. The arrow keys' scroll ran on every render, and could park a row
   under the sticky boxes or the keypad. It now runs when the active row
   changes, with scroll margins.
5. The stemmer's final e-drop joined "note" to "not", "made" to "mad",
   "wine" to "win" and "here" to "her". It now drops an e only where
   four letters stay (decision 5's examples still hold).
6. A tap in a keypad gap blurred the box; 7. Esc's keypad could not be
   reopened without leaving the box (decision 2).
8. The sheet emptied before it slid away; it now keeps its last entry.
9. The Enochian box moved the active row without the combobox's
   attributes; it now leaves the arrows to its caret (decision 12).
10. The meaning and source ran together for screen readers, and two
    dimmed texts fell below AA contrast; the dimming is gone.
11. A Keys link scrolled to the Key, not its word, and kept the Golden
    Dawn version; it now selects Dee's and scrolls to the word.
12. Stage 6 was missing, and decisions 4, 6 and 12 described what was
    not built; they now describe what was.
13. A word opened from a cold `?w=` link took two closes.
14. The live count could count a word twice.
15. "light light" lost its exact hits, and stopwords were bold in
    phrases.
16. An unused label, and a plain `<a>` to the Keys page (now the app's
    `Link`). Left: resetting the groups on mount costs one render.

**The browser check** (headless Chromium over CDP against `next dev` on
127.0.0.1 with CI's placeholder environment, the Browser pane being
hidden), at 360, 390 and 1280 px, light only (the app has no dark mode):
the grouped results for "light", "power" and "god"; the sheet with "In
the Keys" (IAD, Key 1); the two panes (LONSHI, Key 7); the keypad docked
at 360 and 390 px (`inputmode="none"`, focus and caret kept, "OLP"
typed) and dropped down at 1280 px; a cold `?q=power&w=LONSHI`; the
link into the Keys page (Key 7 open, "power," selected); closing twice
quickly, which stays on the page and keeps the query; no horizontal
scroll at 360 px; and no console errors. Not measured: hydration time
on a production build (the load made timings meaningless). Not checked:
iOS Safari (no device), a phone's own keyboard staying down (headless
can't show it), dark mode (none).

## Commits

| Commit | Change |
| --- | --- |
| e5b1e579 | Stage 1: the plan |
| 97ee7e83 | Stage 2: search and the Keys uses, with tests |
| 02b73697 | Stage 3: the page, its text and description, the search refresh |
| 55bfd020 | Stage 4: the keypad |
| 2678c80b | Stage 5: In the Keys, and the Keys page's anchors |
| (this) | Stage 6: the final review's fixes, this record, current status |

## Verification

- **`search.test.ts`** on the real data:
  - "light": OLPIRT and OLPRT lead `means`.
  - "power": tier 0 includes BAB and LONSHI.
  - "god": MAD, OIAD and IAD in tier 0, with Keys use first.
  - "fire": FIRE pinned, then BITOM and PRGE.
  - "go": no God. "angels" finds "angel". "son of light" works as a
    phrase. "the" gives no English. "24" finds the numbers.
  - "OL": OL pinned, and `spelled` leads. "URBS" finds VRBS, "KAPENE"
    finds itself, and BYNEPOR can be typed as BINEPOR.
  - "(" throws nothing. "meaning unknown" is never found. A "part in"
    piece ranks below ordinary ones.
- **`keyUses.test.ts`:** a split word, Key 19 counted once, an Aethyr
  name, a word Casaubon lacks.
- **Component tests:** the groups, hidden empty groups, bold matches,
  URL read and write (a cold `?w=`, and closing without leaving the
  site), the keypad keeping focus and caret, one bottom panel at a time,
  combobox keys, the live count, and the Keys page's anchors.
- **The server HTML** has rows with meanings. `pageTexts.test.tsx`
  passes.
- **The full gate** in a clean worktree on /home with Node 24, at every
  commit.
- **A browser check** at 360, 390 and 1280 px, in light (the app has
  no dark mode): the
  boxes, the keypad, the sheet and the panes, Back, a shared link, the
  Keys link, hydration time, and no horizontal scroll at 360.

## Risks

- **HTML weight:** +25 KB gzipped for the meanings (from 30 to about
  55 KB). Accepted for search. If it matters, the second script span in
  each row can go.
- **The ranking is heuristic** on free text. The tests pin it on real
  queries rather than a theory of WE's punctuation.
- **The keypad on iOS** is unverified (no Safari device).
- **Copyright.** The dictionary's text is already in the repository, and
  this plan adds none of it. The Keys' English is Casaubon (1659) or
  Crowley (1912), both public domain. Agents print no long passages.
