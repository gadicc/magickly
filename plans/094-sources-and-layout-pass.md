# Sources and layout pass: inventory — 21 November 2026

Status: inventory; A1, A2 and A4 built 22 November 2026 and the reading
column's width settled (below); the rest is not decided or built. One question for Gadi remains open, the built-in rituals. Read [current status](000-current-status.md)
first. Follows the Oration's pass (commit 74124e7e: the text re-based on
Dee's manuscript, James kept as readings) and the layout rule in AGENTS.md
("Layout: phones first, wide screens used well", commit ed735ec1).

## How this was made

Two read-only agents (Opus 5.5, medium), 21 November 2026:

- **Sources.** Every public route in `src/seo/pages.ts`, dynamic routes
  once each: where its content comes from, what it cites, how exactly
  (leaf, book, nothing), whether it was checked against more than one
  witness, and where the lightbox would help. Read from the repository
  only; nothing fetched. Rows it marked as inferred are marked so here.
- **Layout.** 53 pages (the 43 `PUBLIC_PAGES` and one sample per dynamic
  route) measured in headless Chromium against the dev server at 375,
  320 and 1,440 px: sideways overflow, characters a line of prose blocks
  of 150+ characters (width ÷ the block's average glyph width), what sits
  beside the main column, tap targets under 32 px. The method gives the
  Oration's prayer 202 characters a line and `PageText` 123, against 197
  and 121 measured by hand. Scripts and data were kept in the session's
  scratchpad, not the repository.

Verified by hand since: the mirror's total (3,780,504 bytes against the
4.5e6 cap in `src/sources/mirroredPages.test.ts`); the site calling the
built-in rituals Regardie's (`src/seo/pages.ts`, `GoldenDawnText.tsx`,
`/gd/rituals`). Not verified: the hydration error on
`/gd/symbols/shewbread`, the `/kabbalah/tree` select labels.

## Questions for Gadi

1. **The built-in rituals.** `/doc/neophyte`, `/doc/zelator` and
   `/doc/theoricus` serve full ritual texts (`src/doc/0=0.pug`, `1=10.pug`,
   `2=9.pug`, 837–1,124 lines) described as Regardie's. AGENTS.md treats
   every Regardie volume as in copyright ("quote, mirror or trace
   nothing"); plan 091 does not mention the rituals. Whose wording they
   are has not been compared. A possible re-basing witness, public domain
   everywhere: *The Equinox* I(2), 1909, and I(3), 1910 (which grades each
   holds is from memory, unchecked).
2. ~~**The Oration's layout**~~: settled 22 November 2026: B, the
   column with rails, from mock-ups sent 21 November.
3. ~~**The reading column's width**~~: settled 22 November 2026: 32rem.
   Measured by counting the characters on rendered lines of the Oration
   in Roboto at 16 px: 32rem holds about 69 characters a line, 36rem
   about 78, 40rem about 88, 46rem about 101. Plan 089's "46rem ≈ 70
   characters" was an estimate, wrong by about half; AGENTS.md now gives
   the measured figures. Gadi chose 32rem from a four-width mock-up,
   finding 36rem already a little narrow but putting reader comfort first
   for a long text. The prayer is justified, with hyphenation.
4. **The ritual reader's column** (`readerShell.module.css`, 46rem, plan
   089 decision 2) runs about 100 characters a line by the same measure
   (the speech bubbles' padding takes it to 92–94). Narrow it to match, or
   keep it, since speech is broken into short turns? Not yet asked.

## Findings

**Layout.** Nothing overflows sideways at 375 or 320 px. On a wide screen
almost every page is one centred column, either too wide for its prose or
narrow with empty margins; only five pages put anything beside it.

| Cause | Pages | Characters a line at 1,440 px |
|---|---|---|
| `PageText` at MUI `md` (852 px) | 21 | 118–127 |
| Prose directly in a `lg` Container (1,152 px): the symbol, sigil and tablet "version" sections, the halls editor, `/study`, geomancy reference notes, open-source entity frames, the 72 angels' `<details>` | 11 | 165–249 |
| Container `md` without `PageText`: `/help/temples`, `/help/ritual-pug`, `/open-source` intro | 3 | 122–131 |
| The Oration's prayer, no container | 1 | 202 |
| The reader and the book (`/doc/*`, `/books/*`), partly a 13 px font | 5 | 92–108 |

Small tap targets: the footer's 36 links (17–19 px tall, every page); the
SVG/PNG export buttons (40×25); the tablets' letter buttons (25×39); the 72
angels' "full entry" icons (20×24, 72 a page); the sephirah and path pages'
path links (32×50, 50 a page); table links on zodiac, planets and grades
(16 px tall); `/gd`'s grade links (29×29).

**Sources.** Structured evidence exists in a few datasets only: the Keys
(`sources` with leaves, `checked`), the tablets (`readings`), the
planetary names (`witnesses`), Lenain (apparatus). Others cite in header
comments, and 19 tables cite nothing: sephirot, paths (a hermetic.com
link), grades, degrees, archangels, god names, angelic orders, souls,
kerubim, four worlds, tribes, Christian choirs, stones, scents, chakras,
body parts, alchemical elements, symbols, elementals; Hebrew letters cite
Wikipedia. Each dataset records sources its own way, and at least five
places build scan links by hand (`tabletNotes` `sourceUrl`,
`hallSourceUrl`, `SigilsText`, `KameaSigilsText`, `DrawnAfter`,
`oration/readings.ts`). The lightbox (`SourceLink`) is used on the planet,
angel, Lenain, geomancy and component pages; the mirror has room for about
two more pages before plan 080's file storage.

Visible inconsistencies with no note: Tiphareth = Raphael and Hod =
Michael in the sephirot, Sun = Michael and Mercury = Raphael in the
planets; the paths' Hebrew and Hermetic letter schemes; chakras, a modern
correspondence, unlabelled.

## Inventory, by value

Value: how much readers rely on the page (angel pages draw the most
search traffic; core reference and hubs next) × the size of the gap ×
feasibility. Effort S/M/L.

### A. Shared layout fixes (one change, many pages)

| # | Work | Reach | Effort |
|---|---|---|---|
| A1 | ~~`PageText` to the 32rem reading column~~ (built 22 November, a2afbdee) | 21 pages | S |
| A2 | ~~The Oration's column and rails~~ (built 22 November) | 1 | S |
| A3 | A reading column inside wide tool pages, notes and sources as a rail: one wrapper for the symbol, sigil and tablet "version" sections, then the halls editor, `/study`, geomancy notes, entity frames, the 72 angels' notes | 11 | M |
| A4 | ~~Footer link spacing; export buttons' size~~ (built 22 November: 44 px targets on touch screens, 24 px with a mouse) | every page | S |
| A5 | Help pages, the reader's and book's measure | 5 | S |

A1 changes the text width on pages the docs screenshots may show; check
`scripts/docs-screenshots` before it lands. Rails beyond A2 and A3 are
per-page work, decided page by page with mock-ups.

### B. Shared sources groundwork

| # | Work | Unlocks | Effort |
|---|---|---|---|
| B1 | One `<Cite>` component: links the exact leaf (archive.org `n<leaf>`, Google Books `pg=PA`, Gallica `/f`), opens the lightbox when the page is mirrored; replaces the hand-built links | every sourced page | M |
| B2 | One provenance shape in magick-data: a works registry (item, edition, public-domain basis) and per-row `sources`/`checked`, after the Keys' shape; a minor release | C1–C6 | L (design first) |
| B3 | Per-row source notes in the entity table (`EntityTable`/`Row`) | ~60 entity pages | S, after B2 |

B2 is an architecture change: assess, plan, review and spike before
building it.

### C. Sources passes, by page

| # | Route | Pages | Gap | Witnesses to check | Effort | Data |
|---|---|---|---|---|---|---|
| C1 | `/kabbalah/angel/[slug]` | 72 | Strong already; "In the book" links our transcript, not the 1823 page; psalms unchecked against the Vulgate | Google Books qt9SAAAAcAAJ; a Vulgate | S | little |
| C2 | `/kabbalah/sephirah/[id]`, `/kabbalah/tree` | 12 | Nothing cited; the archangel conflict; chakras unlabelled | Agrippa 1533/1651, II scale of ten; Mathers, *Kabbalah Unveiled* (b24884443); Kircher 1653; *777* (1909) if a scan exists; Equinox I(2) | L | yes |
| C3 | `/kabbalah/path/[id]` | 22 | Both letter schemes unsourced; letters from Wikipedia; tarot unsourced | Kircher's tree; Westcott, *Sepher Yetzirah* 1887; Kalisch 1877; Mantua 1562 (inferred available) | M–L | yes |
| C4 | `/astrology/planet/[id]`, `/astrology/planets` | 16 | Names well witnessed; archangels, god names, colours unsourced | Agrippa II scale of seven; Heptameron (*Fourth Book* 1655, b20458563); Barrett 1801 | M | yes |
| C5 | `/enochian/dictionary` | 1 (1,917 words) | ~2,000 meanings from "WE", an anonymous list of unknown licence | Phase 1: Keys words to Casaubon 1659 leaves from `keys.json5`; then Sloane (offline, plan 083) | M, then L | yes |
| C6 | `/gd/symbols/*` | 4 | Research done (plan 080, the components' Provenance rows) but not shown on the pages | Equinox I(2) | S | no |
| C7 | `/gd/grade/[id]`, `/gd/grades` | 13 | Nothing cited | Equinox I(2)/(3); Regardie vol. 1 as links | S–M | yes |
| C8 | `/astrology/zodiac` | 1 | One column cites *777*; rulers, dates, tribes, angels unsourced; tribe orders vary | Agrippa II scale of twelve; Equinox I(2) Diagram 16 | M | yes |
| C9 | `/astrology/planetary-hours` | 1 | A sacred-texts.com link only | Mathers, *Key of Solomon* 1889; Gallica Clavicule MSS (inferred) | S | header |
| C10 | `/astrology/kamea/sigils`, `/gd/sigils` | 2 | Exact leaves; no lightbox | Agrippa p149 is already mirrored | S | no |
| C11 | `/gd/halls/[slug]` | 15 | Regardie vol. 2 only, in copyright | Equinox I(2) for the Neophyte (inferred) | M | no |
| C12 | `/enochian/keys`, `/enochian/tablets` | 2 | Exemplary; waiting on Sloane 3191 (plan 083) and a second reading | — | M | yes |

Done or nothing needed: the Oration, the 72 angels' index, the Lenain
edition, geomancy. Hubs, help and tools inherit from their data.

Two public-domain witnesses would serve several rows at once: *The
Equinox* I(1–10), the main witness for Golden Dawn facts since Regardie
may be linked but not copied, and a stable scan of *777* (1909), not found
on archive.org so far (Google Books and HathiTrust untried).

### D. Smaller things seen in passing

- `/gd/symbols/shewbread`: a hydration attribute mismatch (unverified).
- `/kabbalah/tree`: the selects' labels read like field paths
  ("angelicOrder.name.en"); intended or not is unchecked.
- The dev server logs 503s from `/api/auth/get-session` on many loads.

## Suggested order

1. Gadi's questions 1 and 4.
2. **Layout, serially, here**: A3 with mock-ups (A1 and A4 done). They
   touch shared components, so one at a time; each a commit, checked at
   375, 768 and 1,440 px.
3. **Quick source wins**: C1, C6, C10 (small, separate files, high
   traffic for C1).
4. **B1, then B2's design** (plan, review, spike), then B3.
5. **Source passes C2–C9 in parallel**, one subagent per dataset, each in
   its own worktree on a gate branch, since they touch separate data files;
   magick-data changes land together in one release.
