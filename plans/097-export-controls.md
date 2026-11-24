# The export controls — 23 November 2026

Status: stages 1 and 2 built on 23 November 2026 and on `main`, each
reviewed and checked in the browser (see
[As built](#as-built-23-november-2026)). Stage 4, a share row under the
formats (decision 7), added on 24 November 2026. Drafted on 23 November,
after two rounds of mock-ups on which Gadi chose the layout (decision 1),
answered the question of what Share sends on the personal pages
(decision 3) and moved the notes under the box into the confirmations
(decision 2). The mock-ups are in
[097-export-controls-mockups.html](097-export-controls-mockups.html), a
self-contained page to open in a browser. 096 is the sigil styles, on
`magickli-gate-styles`.

Gadi's request (23 November 2026): the export block under the drawings
"got a little bit crowded"; improve it, perhaps with file icons carrying
the extensions, grouped by action, and perhaps drop "Copy page link",
since the app bar has a Share button. Then, in the same session and after
the rest, make the page's state reach Share so the page link can go.

## Background

`src/export/ExportControls.tsx` (plan 027) sits under the drawing on eight
pages: the Tree, the tablets, the rose sigils, the kamea sigils, the
geomancy reading, the candlestick, the table of shewbread and the hall
editor. It offers up to nine controls on four centred lines:

- Download: SVG | PNG
- Copy to clipboard: SVG | PNG
- Image link: SVG | PNG (open) | Copy link (the SVG link only)
- Copy page link (on the five pages that pass `share`)

Labels and buttons don't line up, so each line has its own ragged edge,
and the pipes read as text. A page without an image link for its current
settings shows `linkNote` instead of the third line; a page whose
contract is personal adds "Links include what you entered here."

**What Share does today** (`src/app/MyAppBar.tsx`, `share()`): it passes
`window.location.href` to `navigator.share`. Where the browser has no Web
Share (Firefox on the desktop, for one) it shows an alert, "Sharing not
supported on this platform", so on those desktops "Copy page link" is
the only way to get a link. When the reader dismisses the share sheet,
`navigator.share` rejects with `AbortError`, and that also shows the
"could not be shared" alert.

**Which pages hold their state in the address bar:**

| Page | State in the URL | Personal | Page link today |
| --- | --- | --- | --- |
| Tree | yes, the query (`router.replace`, `tree.tsx`) | no | same URL |
| Tablets | yes, the query (`history.replaceState`, `urlState.ts`, plans 090 and 095) | no | same URL |
| Rose sigils | read on load, never written back | yes | builds the query |
| Kamea sigils | read on load, never written back | yes | builds the query |
| Geomancy reading | read on load, never written back | yes | builds the query |
| Candlestick | no (the version is local state) | no | none |
| Shewbread, hall editor | nothing to hold, or their own share buttons | no | none |

The three personal pages keep their state out of the address bar on
purpose. Plan 027 decided that sigil text and readings reach a link only
through an explicit action with visible wording, never an automatic URL
rewrite, because a URL puts them into browser history, logs and caches
(the comment on `src/app/(public)/gd/sigils/page.tsx` says so). A URL
hash would not change that: it still lands in history, and a shared
link with a hash could no longer be drawn on the server. So "save the
state in the URL" would reverse plan 027 on those pages, and on the other
two it is already done. Decision 3 gets the same result without it.
Analytics are not a factor either way: `insightsUrl` reports the path
only, never the query.

## Decisions

### 1. One row per format

Chosen by Gadi on 23 November 2026 from five options (the mock-up file
keeps them all).

- One bordered box (the theme's divider colour, 12 px radius), at most
  24rem wide and centred under the drawing; a row per format, divided by
  a rule.
- Each row: a file icon with the extension in a coloured band (SVG
  orange, PNG green; each with a dark-theme value, and the band's text in
  the page background colour on the dark theme so it stays legible), the
  format's name, a one-line hint under it, then three actions with the
  icon above the label: **Save** (download), **Copy**, **Link**.
- Labels at weight 400 in the link colour (Gadi asked to see bold and
  regular side by side and chose regular).
- Hints: SVG "Sharp at any size", PNG "Pastes anywhere".
- Targets: at least 48 × 52 px with `pointer: coarse`, 40 px tall with a
  mouse (AGENTS.md's floors are 44 and 24).
- Logical properties throughout, so the row mirrors in Hebrew. The format
  names stay in Latin letters. The icon is decorative (`aria-hidden`);
  each row is a `role="group"` named by its format.
- Accessible names contain the visible label (WCAG 2.5.3): "Save SVG",
  "Copy SVG to clipboard", "Copy SVG image link", and the same for PNG.
  "Download SVG" became "Save SVG" for this.

### 2. A link is copied, and its confirmation offers Open

Today's three link controls (open SVG, open PNG, copy the SVG link)
become one Link per row, which copies that format's absolute image link.
A reader wants the link to paste somewhere far more often than to open
it, and the PNG link could not be copied at all. The confirmation names
the format ("Copied PNG image link") and carries an **Open** action, a
plain link to the image in a new tab. With an action it stays 6 seconds
rather than 2.5 (MUI pauses it while hovered or focused).

**Nothing sits under the box** (Gadi, 23 November 2026: a note there
crowds the space, and is only needed at the moment of the click). The
two notes that sat there move into the confirmation:

- **A personal page** (its contract is personal): Link's confirmation
  adds "It includes what you entered here." That is the moment a reader
  can still decide not to paste it, which is what plan 027's "visible
  wording" is for.
- **No image link for the current settings:** Link looks disabled in
  each row (greyed, `aria-disabled`), so the rows keep their shape, but
  stays focusable; tapping it shows the page's `linkNote` ("No image
  link for these settings.") as an info confirmation. A truly disabled
  button would explain nothing, and screen readers would skip it.

A page with no image route at all (the hall editor) shows Save and Copy
only.

### 3. "Copy page link" leaves the block; Share carries the page's state

- `ExportControls` loses its `share` prop and the page-link button.
- **Tree and tablets:** nothing to do; their URL already is the page link.
- **The three personal pages** register their link builder with the app
  bar (a small context, say `usePageShare(() => url)`), and Share uses it
  in place of `window.location.href`. Nothing rewrites the address bar,
  so plan 027 holds: Share is an explicit action, and its wording comes
  with it. The share sheet shows the link itself; without Web Share the
  confirmation reads "Copied link to this page. It includes what you
  entered here." Gadi chose this on
  23 November 2026 over two alternatives: those pages keeping an
  explicit "Copy link to this page" of their own while Share sends the
  bare page, or Share sending the bare page with nothing in its place. A
  reader who taps Share after drawing a sigil expects the sigil to go
  with it.
- **Share without Web Share copies the link** and confirms it in a
  snackbar ("Copied link to this page"), instead of the alert. A
  dismissed share sheet (`AbortError`) says nothing; any other failure
  falls back to copying.
- **Page prose:** `TabletsText.tsx` ("use *Copy page link*") and
  `TreeText.tsx` ("copy a link that opens the Tree with your settings")
  point to Share instead. That re-keys their search records, so the
  change publishes embeddings (AGENTS.md, within the pre-authorised
  budget).

### 4. PDF-ready, not PDF behind a flag

The rows render from a list of formats, each with its name, hint, icon
colour and its Save, Copy and Link actions. PDF is not in the list: no
PDF exporter exists yet, so a flag or commented-out entry would have
nothing behind it. Instead the file icon already has a PDF colour, a test
renders three formats to prove the layout takes a third row without
moving anything else, and the follow-up below records what PDF needs.
(Gadi suggested a flag or commented-out code; this is the "or something".)

### 5. Translations

Every string in the block and in Share's fallback is marked for Lingui:
labels, hints, accessible names, confirmations and notes. A new `export`
scope in `scripts/i18n/context.json` (`src/export/`) describes the block
("download, copy and link controls under a drawing; SVG and PNG are file
formats and stay in Latin letters"). Hebrew is translated and reviewed in
`src/locales/he/messages.po`. None of these pages has a Hebrew edition
yet, but the interface around them is already Hebrew for Hebrew readers.

### 6. The mock-ups are kept

`plans/097-export-controls-mockups.html` holds the chosen design in each
state (phone light and dark, after Link, no image link, with a mouse,
Hebrew, three formats), the label weights and the first round of
options, so the choice can be revisited (to save space, say) without
redrawing them. It loads Roboto from Google Fonts and falls back to the
system font; it is a design reference, not app code.

### 7. A share row under the formats (24 November 2026)

Gadi, the day after stage 2: Share in the app bar is enough in
principle, but a labelled place to share right under the export box is
nicer. The app bar also slides away as the reader scrolls (it hides on
scroll), so when a sigil or a reading is finished, the icon is usually
off screen; and it is an icon with no label. Three rounds of mock-ups in
[097-export-controls-share-mockups.html](097-export-controls-share-mockups.html)
(round 3; rounds 1 and 2 tried an outlined button, a pill, a full-width
tonal button, a tinted footer on the box, and a row, with hints placed
three ways) settled on D5b:

- **A third row in the box, on a tint of the link colour** (the theme's
  primary at about 8% light, 10% dark), with a rule above it like the
  rows between formats.
- **Its lead icon is a web page drawn as the file icons are**: the same
  outline and band, with WEB in the band, in the link colour.
- **Its name is "This page"** (Gadi's choice over "Web page"): beside
  SVG and PNG, "Web page" would read as a third file format, an HTML
  save; "This page" says it is where the reader is. The band keeps WEB
  so the icon matches the rows.
- **Its hint** is "With your chosen options" by default, and a page may
  override it or turn it off. On a page that hands Share a personal
  link, it is "Includes what you entered", which puts plan 027's
  wording before the tap as well as after it. Pages with nothing to keep
  (the shewbread, the candlestick, whose version is not in its URL yet,
  and the sigil pages while there is no sigil) show no hint.
- **One action, Share**, with the share icon and label in the actions'
  column under Link; its accessible name is "Share this page", which
  contains the label. It does exactly what the app bar's Share does
  (decision 3): the page's registered link or its address, the share
  sheet or a copied link, the same confirmations. One implementation
  serves both.
- **The hall editor shows no share row**: it has its own "Copy share
  link", which carries the hall itself; joining the two is a follow-up.

## Open questions

1. **Wording.** "Save" rather than "Download" (shorter under an icon),
   and the two hints.

## Stages

1. **The rows** (decisions 1, 2, 4 and 5 for the block). Rewrite
   `ExportControls` around the format list; a `FileIcon` component; the
   snackbar's Open action; both notes moved into the confirmations; tests
   for each action's accessible name, both link copies, the Open href,
   the personal wording, the `aria-disabled` Link and its note, the
   no-route page and three formats. The `share` prop and its button stay
   for now, as a plain text button under the box, until stage 2.
   Opus 5.5 high (`opus-high`).
2. **Share takes over** (decision 3, and 5 for Share). The page-share
   context, the fallback and `AbortError`, the three personal pages
   registering their builders, removing `share` and the button, the
   reworded personal note, the callers' tests (`tablets.test.tsx`,
   `squares.test.tsx`, `tree.test.tsx` click "Copy page link" today), the
   page prose and the embeddings publish. Opus 5.5 high.
3. **Check and review.** The browser pass below; a fresh-context review
   (`opus-reviewer`) of the whole diff against this plan; the full gate on
   the final candidate.
4. **The share row** (decision 7; added 24 November 2026, on
   `gate/export-share-row` from the fast-forwarded `main`). Share's
   behaviour moved to one place both the app bar and the row call; the
   row, its icon and hints; per-page hint overrides; translations; tests;
   then the same review, browser pass and gate. Opus 5.5 high.

Both code stages go on `gate/export-controls`, in a worktree beside the
main checkout, as gated commits that Gadi fast-forwards.

## Verification

- `pnpm gate` on the final candidate; per stage, the affected tests,
  `pnpm i18n:check`, types and lint.
- In the browser, every page that has the block, at 375, 768 and 1,440 px,
  light and dark, with a touch and a mouse pointer: no sideways scroll,
  targets as in decision 1, the box centred and at most 24rem. The Hebrew
  interface on at least the tablets and the rose sigils: the rows mirror.
- Each action once by hand on Chromium and Firefox: both downloads, both
  copies (paste the PNG into another app), both links and Open, and Share
  with and without Web Share (Firefox desktop for the fallback; Chrome on
  Android for the sheet, including dismissing it). Safari stays untested
  (no device), as before.
- `pnpm search:build` reports full coverage after the publish.

## Risks

- **Share now sends typed text on the personal pages.** Mitigated by
  Share being the reader's own tap and by the wording that comes with it
  (decision 3). With no note on the page, a reader learns that a link
  carries their text only after tapping; nothing has left the device by
  then.
- **Open is hard to reach by keyboard** before the confirmation goes; the
  link is on the clipboard either way.
- **Hebrew labels may run longer** than the English under the icons;
  check at 320 px.
- **Copying SVG as an image** works only where the browser supports it;
  it falls back to text, as now, and the confirmation says which.

## Follow-ups (not in this plan)

Listed in [plan 000](000-current-status.md).

- **PDF export.** A third row. Needs a client-side SVG-to-PDF path (for
  example svg2pdf.js with jsPDF) with the drawing's fonts embedded
  (Hebrew, Enochian, the halls' fonts via `prepare`), the page sized from
  the viewBox, the credit in the PDF's XMP as in PNG and SVG today, and a
  `?format=pdf` on the image route if PDF links are wanted. Copy is
  likely to stay unavailable for PDF (no clipboard type for it), so its
  row may show Save and Link only.
- **The candlestick's version in its URL**, so Share and the image link
  agree there too.
- **Share by hand where it could not be tested here:** the share sheet
  (and dismissing it) on Android, the copy fallback on Firefox desktop,
  and Safari (no device).
- **Two confirmations at once:** the export box's and Share's snackbars
  both sit bottom-centre and can overlap.

## As built (23 November 2026)

| Commit | What |
| --- | --- |
| `d0ca031c` | This plan and its mock-ups |
| `e15d221d` | Stage 1: the rows (`src/export/formats.ts`, `FileIcon.tsx`, `ExportControls.tsx`), the notes moved into the confirmations, translations |
| `7c0f4de4` | Stage 2: `src/app/pageShare.tsx` and `ShareButton.tsx`; the three personal pages register their link; `share` and "Copy page link" removed; the tablets, Tree and geomancy texts point to the share button; search rows republished |

Rebased once onto `a1576fe1` (the pyramid drawing); the SHAs above are
after that rebase. Each stage was built by Opus 5.5 at high effort,
reviewed by a fresh-context Opus 5.5 at high effort (nine findings on
stage 1, one medium and four low on stage 2, all fixed or recorded
below), and checked by hand in a headless Chromium on the dev server:
the tablets, Tree, rose sigils, geomancy reading, shewbread and hall
editor at 375, 768 and 1,440 px, light and dark; touch targets 48 × 52
px, 44 × 40 px with a mouse; no sideways scroll; and real clipboard
reads of Share and Link on four pages, including a cleared sigil
sharing only the bare page.

Where the build departs from the decisions above, or adds to them:

- **Accessible names** are "Save SVG" rather than "Download SVG", so
  each contains its visible label (WCAG 2.5.3), in English and Hebrew;
  a test checks both catalogs.
- **A failed link copy** still offers Open, with "Could not copy the
  link. Open it instead."
- **Link stays greyed with a note** on the rose and kamea sigils too
  when there is no sigil yet ("No image link until a sigil is drawn.").
- **The page link's personal wording** reached stage 1 as well, so
  that stage was safe on `main` without stage 2.
- **Whether a page is personal** comes from its image contract
  (`CONTRACTS[slug].personal`), in the export box and in Share alike.
- **With no sigil**, the rose and kamea pages hand Share their bare
  page, so a reader who arrived with `?text=` and cleared it never
  sends the old text.
- **Share sends the whole address** on pages that register nothing
  (the tablets and Tree among them), as the app bar always did:
  unrelated parameters and a `#section` go with it, where "Copy page
  link" sent only the page's own choices.
- **A second tap while the sheet is open** (`InvalidStateError`) is
  silent, like a dismissed sheet. Copying after any other failed sheet
  runs outside the tap, which Safari and Firefox usually refuse; the
  snackbar then says it could not copy.
- **Search:** 6 and then 10 records re-embedded (ledger, 23 November:
  $0.0229 and $0.0248 estimated).

### Stage 4, the share row (24 November 2026)

| Commit | What |
| --- | --- |
| `979dc9e2` | Decision 7, stage 4 and the share mock-ups |
| `df6e114a` | The share row: `useSharePage()` in `src/app/pageShare.tsx` now does what Share does for both the app bar and the row; `FileIcon`'s `web` kind; `ExportControls`' `share` and `shareHint` props; per-page hints; translations |

Built by Opus 5.5 at high effort and reviewed by a fresh-context Opus
5.5 at high effort (no defect above low; three low fixed: the
translators' context, the row's Share now waits like the other actions
while one is busy, and the share sheet's title outside the site chrome).
Checked by hand in a headless Chromium on the dev server: the rose
sigils, Tree, shewbread, geomancy reading and hall editor at 375 and
1,440 px, light and dark, against the D5b mock-up; and real clipboard
reads of the row's Share on the rose sigils, tablets and Tree, plus a
cleared sigil, each matching the app bar's.

Where the build departs from decision 7, or adds to it:

- **The share sheet's title** comes from the page-share provider (the
  same site title the app bar passed), since the row has no title of
  its own.
- **Before a page registers** (on the server, and until hydration), the
  hint follows the image contract, so the geomancy reading shows
  "Includes what you entered" from the first paint; once a page
  registers, its registration decides.
- **The row's confirmation** lasts 4 s, as the app bar's does.
- **During client navigation** from a personal page, the next page's
  row could in principle show the personal hint for one frame; the
  review could not reproduce it on the dev server over three
  navigations, and it would only overstate the warning. Accepted.
