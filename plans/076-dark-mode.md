# Dark mode — 11 November 2026

Status: decisions settled with Gadi on 10 November 2026 (all four
recommendations below), and the ritual reader's colours on 11 November;
spiked 10–11 November 2026; the design reviewed adversarially by Fable
on 11 November 2026 (see "Review"); **built on 11 November 2026** on
`gate/dark-mode` (see "Build" and "Commits"). Read
[current status](000-current-status.md) first. The Enochian dictionary
revamp ([plan 074](074-enochian-dictionary-search.md)) found that the app
has no dark mode; Gadi asked for it to be planned on its own.

## Background

- `src/theme.ts` is MUI `createTheme` with `palette.mode: "light"`, the
  Roboto font and one override (the info `Alert` background `#60a5fa`).
- `src/app/layout.tsx` wraps every page in `AppRouterCacheProvider`
  (`enableCssLayer`), `ThemeProvider` and `CssBaseline`. It sets
  `viewport.themeColor: "#FFFFFF"` and `msapplication-TileColor`;
  `src/app/manifest.json` has white `theme_color` and `background_color`.
- Nothing reads `theme.palette`, a CSS variable or `prefers-color-scheme`.
  About 14 files use `sx` palette strings (`text.secondary`, `divider`,
  …); everything else that has a colour hard-codes it. The Enochian
  dictionary as rebuilt by plan 074 (`src/app/enochian/dictionary/`,
  on `main` since 10 November 2026) is the reference: every colour is an
  `sx` palette string (`background.paper`, `divider`, `text.secondary`,
  `action.hover`, `action.selected`, `primary.main`).
- Most public pages are prerendered (42 static and SSG routes in the
  spike build); `/` is dynamic because it reads the signed-in viewer.

## Decisions

1. **The device setting by default, with a switch in the menu drawer.**
   A reader's first visit follows `prefers-color-scheme`. The foot of the
   menu drawer gets a three-way **Light / System / Dark** switch (MUI
   icons `LightMode`, `SettingsBrightness`, `DarkMode`), labelled
   "Theme". The app bar is not used: at 390 px it already truncates
   "Enochian Dictionary", and an icon there costs 40 px of title (mock-up
   sheets `dm3`, `dm4`). The choice is kept per browser in
   `localStorage` (MUI's default keys `mui-mode` and
   `mui-color-scheme-dark`/`-light`); it is not synced to the account
   (follow-up below).
2. **Palette "Midnight".** One dark scheme, named `dark` (MUI's dark-only
   component styles, such as the app bar's, key on that name; a
   custom-named second scheme does not get them). Light stays exactly as
   it is today.

   | Token | Light (unchanged) | Dark |
   | --- | --- | --- |
   | `background.default` | `#fff` | `#0f141d` |
   | `background.paper` | `#fff` | `#161d29` |
   | `text.primary` | MUI | `#e4e8ef` |
   | `text.secondary` | MUI | `#a9b2c1` |
   | `divider` | MUI | `rgba(170, 190, 220, 0.16)` |
   | `primary.main` | `#1976d2` | `#8ab4f8` |
   | App bar | `#1976d2`, white | `AppBar.darkBg #1b2b47`, white |

   Contrast (WCAG): `text.primary` 15.0:1 on `background.default` and
   13.8:1 on paper; `text.secondary` 8.6 and 7.9; links (`#8ab4f8`) 8.8 and
   8.0, and 6.7 on the app bar. App-specific tokens are added to both
   schemes under `palette` (module-augmented types) so that CSS modules
   can read them as variables:

   | Token | Light | Dark | For |
   | --- | --- | --- | --- |
   | `ink` | `#000` | `#d6dae0` | re-inked diagram lines (decision 4) |
   | `plate` | `transparent` | `#f3f0e8` | light card behind "document" drawings |
   | `ritual.surface` | `#efeae2` | `#0f141d` | reader and visual editor background |
   | `ritual.bubble` | `#fff` | `#1b2333` | speech bubbles and the title card |
   | `ritual.self` | `#d9fdd3` | `#1f3a2c` | the reader's own speech bubble |
   | `ritual.note` | `#f4f4f4` | `#141a24` | notes |

   The ritual values are the "Midnight" option Gadi chose from three
   mock-ups on 11 November 2026 (sheets `dm8`–`dm10`). Role names keep
   their light colours and get a lighter shade of the same hue in dark
   (`darkColor` in `src/doc/ritualBlocks/roles.tsx`): Imperator and
   Hierophant `#ff7a7a`, Praemonstrator `#8ab4f8`, Hiereus `#e4e8ef`,
   Cancellarius `#e6c34a`, Keryx and Psaltis `#ee8f8f`, Stolistes
   `#a3a6ff`, Sentinel `#a6adb8`, Chief Adept `#e0b24a`, Second Adept
   `#ff9d55`, Third Adept `#62c962`. The browser toolbar's dark colour is
   `#303e58`, what `AppBar.darkBg` renders under MUI's elevation
   overlay. The `#60a5fa` info-`Alert` override
   stays the base style and gets a dark override with
   `theme.applyStyles("dark", …)` (a light-only rule would need the class,
   so it would fail with JavaScript off).

   Cost: both schemes' variables add about 22 KB of inline CSS to every
   page, about 3.5 KB gzipped (measured on `/kabbalah/tree`).
3. **Mechanism: MUI CSS variables with a class selector.** `createTheme({
   cssVariables: { colorSchemeSelector: "class" }, colorSchemes: { light:
   true, dark: {…} } })`; `<InitColorSchemeScript attribute="class" />`
   as the first child of `<body>`; `suppressHydrationWarning` on `<html>`;
   `ThemeProvider` gets `disableTransitionOnChange`. The attribute and
   `defaultMode` come from one shared constant used by both the script and
   the provider: each defaults `defaultMode` to `"system"` on its own, and
   a mismatch paints one scheme and then swaps it. MUI emits both
   schemes' variables in the prerendered HTML, the inline script puts
   `light` or `dark` on `<html>` before the first paint, and React accepts
   the attribute it did not render. The spike proved this (see "Spike").
   Rules for every component:
   - Never branch rendering on `theme.palette.mode` or on
     `useColorScheme().mode`: the server always renders light, so such a
     branch is a hydration mismatch or a flash. Use `sx` palette strings,
     `theme.applyStyles("dark", …)`, `var(--mui-palette-…)` in CSS
     modules, or `.dark` selectors in page CSS. Three named exceptions
     read `useColorScheme()`, whose `mode` is `undefined` until after
     hydration: the drawer switch (it renders with nothing selected until
     then), the `theme-color` effect (step 6) and the CodeMirror editor
     (step 5), which mounts on the client. A test fails the build on
     `palette.mode` anywhere outside `src/theme.ts` and on `useColorScheme`
     outside an allow-list of those three files.
   - CSS modules use `var(--mui-palette-…)` (for example
     `entity.module.css`, which copies `text.secondary` today because "the
     theme has no CSS variables").
   - Server components with inline `style={{ color: "#555" }}` switch to
     a CSS variable or a class.
4. **Diagrams: re-ink line art, plate the "documents", keep symbolic
   colours.** (sheets `dm5`, `dm6`.)
   - **Symbolic fills keep their exact colours** in both modes: King and
     Queen scales, elemental and planetary colours, tablet squares, lamen
     collars, hall art.
   - **Re-inked** in dark (black lines and unfilled black text become
     `ink`): Tetragram dots (one component behind the geomancy reference,
     reading, chart and study sets), `AstroGeomancyChart`, the reading's
     planetary pentagram, the seven planetary-spirit sigils (`fill
     #070707` in `svg/astrology/spirits/`; superseded on 13 November
     2026: the sigils are redrawn as one `stroke="#000"` path each and
     that directory is gone, plan 080, "The sigils' sources"), the
     seven-branched candlestick, the table of shewbread, the rose sigil's petals, the
     chakra figure, the lamen's outer ring, and the
     Tree of Life's outlines (sphere and path strokes only; labels on
     spheres keep their colour, so Binah's `#222` and Malkuth's black
     quarter get a light edge).
   - **Plated** in dark (a rounded `plate` card behind an unchanged
     drawing; its padding and radius apply in dark only, so light layout
     does not move): the Enochian tablets (including the Equinox sigils and
     frame), temple hall plans (already on white paper; keep
     `templeHalls.module.css`'s white cards and `HallPanZoom`'s white
     viewport), the help pages' screenshots, every ritual image (all go
     through `ImageFrame` in `src/doc/ritualBlocks/Frames.tsx`: the
     published PNGs, `/api/treeOfLife` drawings, `candidate-hexagram.svg`
     and members' own uploads, whose backgrounds we cannot know), and the
     dark-on-transparent rasters `public/pentagram.png` (drawer logo) and
     `public/pics/about.png` (home tile). Opaque white tile images
     (tree, portae, oration, first key, geomancy) stay as they are.
   - **How, so that exports stay light:** nothing inside an `<svg>`
     changes. The export (`prepareSvgClone` in `src/export/svgExport.ts`)
     clones the element with every attribute but no computed style, and the
     server renderer (`src/render/componentImage.tsx`) renders component
     defaults, so a marker attribute inside the drawing would reach both.
     Instead the page wraps the drawing in an element with a class (outside
     the cloned `<svg>`), and page CSS keyed on `.dark` and that class
     selects by what the drawing already has: its ids (`#paths`), its
     colour attributes (`[stroke="#000" i]`, `[fill="#070707"]`, the
     latter superseded on 13 November 2026 when the spirits' sigils
     became strokes, plan 080, "The sigils' sources") and
     unfilled text (`text:not([fill])`). A rule on a child beats a colour
     the child inherits from a parent's inline style, which covers the
     Tree's paths (`TreeOfLife.tsx`: `style` on `<g id="paths">`). Where
     the colour is an inline `style` on the element itself (the lamen's
     outer ring, `Lamen.tsx` `_outerCircleStyle`), the page rule may use
     `!important`; do not move such styles into attributes, because the
     Tree's export and server bytes are pinned by a test
     (`registry.test.tsx`). Never re-ink with inline `style`, with a CSS
     variable inside an SVG attribute (undefined in a standalone file), or
     in an SVG's own `<style>` block (copied into exports). The fylfot
     cross is an HTML table, not an SVG; its grid is ordinary CSS
     (step 4).
5. **What stays light.** OG cards (`src/app/og`, `src/seo/cardArt.ts`),
   every server-drawn image (`/api/render`, `/api/treeOfLife`,
   `/gd/halls/[slug]/[file]`), downloads and copy-to-clipboard from the
   seven export pages, the help pages' screenshots (captured light, shown
   on a plate), favicons and the manifest, and **print**. The `dark` class
   stays on `<html>` when printing, so every dark rule (variables, `.dark`
   page CSS, `applyStyles`, MUI's own dark styles) would reach paper.
   Step 1 swaps the class to `light` on `beforeprint` and back on
   `afterprint`, and checks a books page and a diagram page printed from
   dark; if headless Chromium's PDF printing does not fire those events,
   the check uses the browser's print dialog by hand, and dark page CSS
   must then also sit inside `@media screen`. In step 6
   `viewport.themeColor` becomes a media pair (white / `#1b2b47`) that
   follows the system, and when the reader picks Light or Dark explicitly
   a small client effect sets both media-tagged `theme-color` metas;
   step 6 checks that an explicit choice opposite to the system survives a
   soft navigation and a reload (Next owns those tags).
6. **Rollout: one gate branch, switched on last.** `gate/dark-mode`,
   staged commits. Until the last commit both `InitColorSchemeScript` and
   the provider use `defaultMode="light"`, the drawer has no switch and
   `themeColor` is untouched, so readers see no change at any
   intermediate commit. Nothing writes `mui-mode` until a reader uses the
   switch, and no earlier MUI colour-scheme code ever ran on the
   production origin (`git log -S`), so no stale key can put a reader in
   dark early. Reviewers reach
   dark by setting `localStorage["mui-mode"] = "dark"`, which the script
   honours whatever the default. The last commit sets `defaultMode
   "system"` and adds the switch.
7. **Light mode does not change.** Every step compares light-mode
   screenshots of the page set (below) with baselines taken from a `main`
   production build on the same machine: headless Chromium over CDP at
   390 and 1280 px, `Emulation.setTimezoneOverride` and a fixed `Date`
   injected before load,
   `GEO_FIXTURE` for location, signed-in pages from the local seed, and
   time-dependent regions (planetary hours, the Moon widget, chat) masked.
   Pixel differences must be intended and named in the commit. Fixing light-mode problems
   the inventory found (roles `#fcf`/`#ccc` text on white) is a follow-up,
   not part of this plan.
8. **No page prose changes**, so the paid site-search refresh
   ([plan 070](070-site-search.md)) is not needed: the switch's labels are
   in the drawer, not in page JSX. `src/search/generated/` is gitignored,
   so each step runs `pnpm search:build` on the branch and on `main` and
   diffs the two `prose.json` files. Because `pageProse` follows a page's
   relative imports (`scripts/search/prose.ts`), no step moves JSX text
   between files or adds a text-bearing component that a page imports
   relatively. Step 1 also adds a test that the catalogue's digest matches
   `manifest.catalogueSha256`: today a drift only switches vector search
   off quietly (`src/search/embeddings/store.ts`).

## Spike (10–11 November 2026)

An uncommitted change in a session worktree at `3c305c78`, before plan
074's dictionary reached `main` (patch kept outside the repository):
Midnight as `dark`, the class selector, the init script and
`suppressHydrationWarning`; CI placeholder environment, no database.
Driven with headless Chromium over CDP.

- **No flash on prerendered pages.** `next build --webpack`, `next start`:
  `/kabbalah/tree` served `x-nextjs-prerender: 1`, cache HIT, `<html>`
  with no class, the init script as the first element of `<body>`, and
  both schemes' variables (`.dark{color-scheme:dark;…}`) in the head. With
  every external script blocked, so only the inline script ran, the first
  render was right in all five cases on `/kabbalah/tree` and
  `/kabbalah/sephirah/tiferet` (SSG): system dark → dark; system dark +
  stored light → light; system light + stored dark → dark; system light →
  light; system dark + stored system → dark.
- **No hydration errors.** With JavaScript on, no console error,
  warning or exception on eight pages (tree, sephirah, dictionary, keys,
  geomancy reading, halls index, a hall, books) in either scheme; the
  class stayed. A client-side navigation (sephirah → tree) kept `dark`.
- **Static stays static.** The build's route table kept 42 static and
  SSG routes; `/` was already dynamic.
- **Development.** Next's guide warns that Strict Mode's remount strips
  attributes the script set on `<html>`
  (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`).
  In `next dev` the class was `dark` and `color-scheme` `dark` after load
  (MUI's provider re-applies it); a dev-only flicker is acceptable.
- **Custom tokens.** `ink`, `plate` and nested `ritual.surface` in both
  schemes come out as `--mui-palette-ink`, `--mui-palette-plate` and
  `--mui-palette-ritual-surface` under both `:root, .light` and `.dark`
  (Node, MUI 9.5.0); the TypeScript augmentation is untested.
- **Export safety.** On `/gd/symbols/candlestick` in dark, a page rule
  `.dark svg [stroke="black"] { stroke: #d6dae0 }` made the lines light on
  the page (`getComputedStyle` → `rgb(214, 218, 224)`), while the
  element cloned and rasterised as `svgExport` does gave 92,979 dark line
  pixels and no light ones, and its XML did not contain the page colour.
  The review then found that the export keeps every attribute, so the
  design selects by existing attributes and ids rather than adding
  markers (decision 4).
- **Out of the box.** With no other change, MUI's dark scheme already
  rendered most text, menus, forms and the Tree of Life correctly. What
  broke is the inventory below.
- **Not verified:** Safari and iOS (no device; `InitColorSchemeScript`
  and `color-scheme` are standard), the PWA in standalone mode, print
  (designed in step 1, checked there). The offline service-worker copies
  carry the same inline script, and `publicShells.ts` checks nothing on
  `<html>` but `data-dpl-id`.

## Review (11 November 2026)

Fable reviewed the draft adversarially against the code on `main`
(`6243ba95`): no blocker, four majors, seven minors, all taken into the
text above. The majors: markers inside an SVG would reach downloads and
server images, so the re-ink selects by existing attributes and ids from
a wrapper outside the `<svg>`; the Tree's paths and the lamen ring take
their strokes from inline styles, which needs a child rule or
`!important`; the `theme-color` media pair would show a dark toolbar
over forced-light pages, so it moves to step 6; ritual images are any
image in `ImageFrame`, members' uploads included, so all are plated. The
draft's reason for the print rule was wrong (`-webkit-print-color-scheme`
is only a vendor prefix of `color-scheme`; the cause is the `dark` class
staying on `<html>`), and its prose check could not run as written
(`src/search/generated/` is gitignored). Claims the review tried and
failed to refute: the custom tokens, the scheme having to be named
`dark`, storage being safe during the light-only period, `ThemeProvider`
taking `defaultMode` and `disableTransitionOnChange`, nothing in `src`
reading the palette or the mode today, export safety apart from
markers, the service worker, the single `<html>` root, and
`themeColor`'s media form.

## Build (11 November 2026)

Six gated commits, one per step, then the final review's fixes (see
"Commits"). Implementation ran in Opus subagents (medium for steps 1, 2,
4 and 6; high for 3 and 5) from briefs written from this plan; steps 4
and 5, which touch separate files, ran at once in two worktrees.

**How each step was checked.** Tools kept outside the repository with
the session's notes (they hold no app code):

- *Light parity:* full-page screenshots of the page set below (29 public
  pages at 390 and 1280 px, plus the open drawer) from a `main`
  production build (`0ef4e33f`), headless Chromium over CDP, with a fixed
  clock and `Math.random`, UTC, all origin storage and the HTTP cache
  cleared before each page, images and fonts awaited, and a pixel compare
  at 1 % fuzz. Large photo tiles sometimes paint late under load, so a
  differing page is recaptured up to twice; the few that still differed
  were checked by eye (always a missing photo tile).
- *Exports and server images:* sha256 of the `/api/render/*`,
  `/api/treeOfLife`, OG card and hall image routes, and of the `outerHTML`
  of every drawing `<svg>` on the seven export pages in light and dark,
  against `main`. React `useId` values (`_r_x_`) are normalised: they
  shift whenever the root layout's component tree changes (step 1 added
  components there), which changes nothing in a drawing. With that, every
  route byte and every drawing's markup matched `main` at steps 2, 3, 5
  and 6.
- *No flash:* first paint with every external script blocked, in each
  system/stored combination; then no console errors on 33 dark pages.
- *Print:* `Page.printToPDF` fires `beforeprint`/`afterprint` in headless
  Chromium; pages printed from dark came out light (mean brightness
  0.93–0.97) and returned to dark.
- *Site-search prose:* `prose.json` byte-identical at every step.
- *The CI-equivalent gate* (frozen install, `loom check` and
  `--production`, biome, typecheck, magick-data smoke, `test:coverage`,
  the webpack and Turbopack builds) in a fresh worktree on /home with
  Node 24, for every commit.

**What the build changed from the plan:**

- The `Alert`'s dark override landed in step 1, not step 2.
- `DARK_SELECTOR` (`".dark &"`, `src/colorScheme.ts`) lets server
  components write dark `sx` rules, since they cannot pass
  `theme.applyStyles` functions to client components. `applyStyles`
  emits `:where(.dark) &`, with no specificity.
- Drawings are re-inked through `src/drawings/` (`Ink`, a `display:
  contents` span, `inkClass` for an existing wrapper, and `plateClass`),
  all outside the `<svg>`. `treeOfLifeFigure.tsx` needed nothing: it is
  drawn only inside hall art, on the hall's white paper. The lamen ring
  and Malkuth's quarters need `!important` (inline styles). The geomancy
  reference and reading pages' pinned HTML digests were re-pinned for the
  wrappers; the old digests reproduce without them.
- The hall editor's panel CSS (`gdHallEditor.module.css`) was done in
  step 4. The source editor (CodeMirror, also on `/gd/halls/editor`)
  swaps a dark theme and One Dark highlighting in a compartment.
- `MyAppBar.tsx` imports the switch through the `@/` alias: `/chat`
  imports from `MyAppBar` relatively, and the prose extractor follows
  relative imports, so a relative import put "Theme" into `/chat`'s
  search prose.
- The gate caught one bug the step's own checks missed: `Typography`'s
  `color="text.secondary"` on the switch's caption, which MUI 9 ignores
  (`src/muiColorProps.test.ts`); fixed in step 6's commit. Two gates
  failed on 5-second test timeouts while another job loaded the machine
  and passed on a rerun.

**Final review.** Fable reviewed the whole branch adversarially on
11 November 2026: no blocker; one major, five minors, all fixed in the
review commit:

- *Major:* the plate's padding came out of small ritual images
  (`border-box`), so the 2=9 ritual's 1em inline image vanished in dark.
  Images now get the plate as a ring (`box-shadow`) that takes none of
  their size.
- With `localStorage` blocked, MUI's script sets no class and the page
  painted light, then dark; a small inline fallback now sets the class
  from `matchMedia`.
- The dark toolbar colour is the bar's rendered `#303e58`; the nav menu's
  current page is `#ff7a7a` (4.67:1 on the menu's real `#323843`).
- Tests: `ThemeColorMeta` now reads the `media` attribute (jsdom has no
  `media` property, so the old test passed on an expando); new tests for
  `PrintInLight` and that each `ink.module.css` rule still matches its
  drawing.
- The switch's group is labelled by its visible caption.

Claims the review tried and failed to refute: the re-pinned digests'
stated reasons; export and server-image safety; the theme-colour metas
across navigation, reload and a device change; no flash in the editor;
the drawer closing on links and Esc but not on the switch; the info
`Alert` in both schemes.

**Not verified:** Safari and iOS (no device), the installed app in
standalone mode, a printer (only `printToPDF`), the service worker at
runtime, and signed-in screens beyond the reader and both editors
(temples administration, chat with messages).

## Inventory of hard-coded colours

Counts from a repository sweep on 10 November 2026: about 38 files of
UI colours to turn into tokens, 22 files of symbolic colours plus the hall
art (one `PALETTE` in `src/components/gd/hall/art/shared.ts` behind about
22 files), 12 code paths and about 35 raster assets that stay light, and
about 25 files already theme-aware or neutral. By step:

- **Shell (step 2):** `MyAppBar.tsx` (`color: "white"` on the sign-in
  icon, `rgba(255,255,255,…)` on the trail, `red` on the current nav
  item), the drawer's `pentagram.png`, `SiteFooter.tsx` `grey.100` band
  (stays light grey in dark), `src/app/page.tsx` (`#555` admin tile, GD
  logo SVG, `about.png`), `Tiles.tsx`, `theme.ts` Alert override,
  `layout.tsx` theme colours.
- **Shared drawings (step 3):** `Tetragram.tsx`, `AstroGeomancyChart.tsx`,
  `reading.tsx`'s pentagram, `planetarySpirits.tsx` + 7 spirit SVGs,
  `SevenBranchedCandleStick.tsx`, `TableOfShewbread.tsx`, `RoseSigil.tsx`,
  `Chakras.tsx`, `Lamen.tsx`, `TreeOfLife.tsx` +
  `treeOfLifeFigure.tsx`, `Tablet.tsx` (plate), `GradeTree.tsx`.
- **Page areas (step 4):** Enochian keys (`#fafafa`, `yellow`, `#666`),
  `entity.module.css`,
  `sephirah.module.css`, `path.module.css`, the geomancy reading (`#aaa`,
  `black` grid), planetary hours (`red`, `#cc5`, `#ccc`, `#aaa`), chat
  (`#f7f7f7`, `#ccc`, `#888`, white fade and chip), `StudyQuiz.tsx`,
  `gd/page.tsx` and `gd/symbols/page.tsx` (`color: "black"`), `sigils.tsx`
  (`red`), `fylfot-cross.tsx` (an HTML table; `black` cell borders,
  `red` wrong answer), `hallPlayground.module.css`, the books reader.
- **Ritual reader and editors (step 5):** `DocRender.tsx` (`#efeae2`),
  `Frames.tsx` (`#d9fdd3`, `#fff`, `#f4f4f4`, and `ImageFrame`, which
  plates every ritual image), `roles.tsx` (officer text
  colours: `black` and `blue` vanish on dark), `frames.module.css`,
  `editing.module.css`, `SemanticEditor.module.css`,
  `linkedCaret.module.css`, `RitualSourceEditor.tsx` (CodeMirror
  `basicSetup` light highlight and an `EditorView.theme`),
  `gdHallEditor.module.css`, `HallViewer.tsx` (`#e0e0e0`),
  `SqlDocEdit.tsx` (already a dark editor; only `#aaa`), `blocks.jsx`.
  `ritualSlashCommands.module.css` uses `Canvas`/`CanvasText` and follows
  `color-scheme` already.
- **Already self-contained:** the moon and Mercury night-sky widgets, the
  tarot images, dark photo tiles.

## Steps

Each step is one or more commits on `gate/dark-mode`, gated in a clean
worktree on /home with Node 24 (CI-equivalent script: frozen install,
`loom check` and `loom check --production`, `biome check`, `typecheck`,
`test:coverage`, `build`), then reviewed. Model bands follow Gadi's
model policy: Opus medium for steps 1, 2 and 4,
Opus high for 3 and 5 (many files, export constraint), Fable high for the
final review.

1. **Foundation, invisible.** Theme with both schemes and the app tokens
   (decision 2), module augmentation for the tokens, init script,
   `suppressHydrationWarning`, `disableTransitionOnChange`, the shared
   attribute and `defaultMode "light"` constant, the print class swap, the
   guard test (decision 3), a test that script and provider get the same
   attribute and `defaultMode`, the catalogue digest test (decision 8),
   and the docs-screenshot capture forced light (below). Check: light
   screenshots unchanged; with `mui-mode=dark` in storage the spike's
   results repeat on the production build; a books page and a diagram
   page printed from dark come out light.
2. **Shell.** App bar, drawer logo plate, footer band
   (`background.paper` or `action.hover`), home tiles, the Alert's dark
   override. `themeColor` stays as it is until step 6.
3. **Shared drawings.** Wrapper classes and page CSS per decision 4; the
   `Plate` wrapper; one sub-step per drawing in the inventory, since each
   has its own colour source (attribute, a parent's inline style, its own
   inline style, SVGR import). Check: for each of the seven export pages
   the downloaded and copied SVG is byte-identical to `main`'s in both
   storage modes, and so is the PNG; `/api/render/*`, `/api/treeOfLife`
   and a hall PNG are byte-identical (the existing `registry.test.tsx`
   hash stays green); OG cards unchanged.
4. **Page areas**, by section (Enochian, Kabbalah, geomancy, astrology,
   chat, study, GD pages, books, help). The rebuilt dictionary uses
   tokens already, so it needs only a dark check, which closes the "no
   dark mode" gap plan 074 records: the two-pane layout, the phone sheet
   (`SwipeableDrawer`), the docked Enochian keypad and the highlighted
   match.
5. **Ritual reader and editors.** Starts with a mock-up of the reader
   surface, bubbles and role colours for Gadi to choose from (the dark
   values in decision 2 are placeholders). Reader surface and bubbles as
   tokens; `ImageFrame` plates every image;
   role colours as per-scheme CSS variables (`--role-hiereus` …) with the
   same hue and a lightness that reads on each background; the hall
   editor and viewer; CodeMirror in `RitualSourceEditor` gets a dark
   theme and highlight style in a `Compartment` switched from
   `useColorScheme()` (one of the allowed reads). Needs a signed-in local
   run with seeded rituals (docs-screenshot seed).
6. **Switch on.** `defaultMode "system"`; the drawer switch (choosing a
   theme does not close the drawer, whose content today closes it on any
   click: `MyAppBar.tsx`, `<Box onClick={handleDrawerToggle}>`);
   `viewport.themeColor` as a media pair and the effect for an explicit
   choice (decision 5), checked across a soft navigation and a reload;
   final dark sweep at 390 and 1280 px of the page set below; Fable high
   adversarial review of the whole branch; plan updated with the
   commits.

**Page set** for light parity and dark sweeps: `/`, `/kabbalah/tree`,
`/kabbalah/sephirah/tiferet`, `/kabbalah/path/1_2`, `/enochian/keys`,
`/enochian/dictionary`, `/enochian/tablets`, `/geomancy`,
`/geomancy/reading`, `/astrology/planetary-hours`, `/gd/symbols/candlestick`,
`/gd/sigils`, `/gd/halls`, `/gd/halls/neophyte`, `/books`, `/chat`,
`/help/temples`, a study set, and (signed in, local seed) a ritual in
the reader and both editors, and the 2=9 ritual, which embeds a Tree of
Life image.

## Docs screenshots

`scripts/docs-screenshots` captures stay light (decision 5). Step 1 makes
the capture set `prefers-color-scheme: light` and clear `mui-mode`, so a
capture on a machine set to dark still produces light images. Light
mode came out pixel-identical on every screen the help pages show (the
bar, the reader and both editors; no shot opens the drawer, the one
light screen that changed), so the images do not change; the capture
was rerun on the final tree to confirm (see "Build").

## Follow-ups

- TODO: keep the reader's choice on the account so it follows them across
  devices (a cookie read by the inline script would keep pages static,
  per Next's guide).
- TODO: dark captures of the help screenshots, served with
  `<picture media="(prefers-color-scheme: dark)">` or by class.
- TODO: light-mode readability of the Candidate (`#fcf`), Member
  (`#ccc`) and Hegemon (`#aaa`) role names on white.
- TODO: a dark `background_color` for the PWA splash, which the manifest
  cannot vary by scheme.
- TODO: when the reader's choice is the opposite of the device's, the
  browser toolbar shows the device's colour until hydration (the
  theme-color effect runs on the client).
- TODO: the switch's roving tab stop starts on Light even when another
  option is pressed (MUI `ToggleButtonGroup`); arrows, Space and Enter
  work.
- TODO: low contrast that predates dark mode: the reader's page numbers
  (2.3:1 on bubbles in dark, 1.4:1 in light).
- TODO: `chat.module.css` and `RitualSourceEditor.tsx`'s dark theme copy
  Midnight's hex values; read the palette variables if Midnight is
  retuned.
- TODO: the colour-scheme guard test catches `palette.mode` and
  `useColorScheme` only; a render reading `prefers-color-scheme`,
  `mui-mode`, the `<html>` class or `theme.palette.*` would pass it.
- TODO (predates this plan): `/gd/symbols/shewbread` logs a hydration
  attribute mismatch in development in both schemes (trigonometry rounds
  differently in Node and Chrome).

## Commits

| Commit | Change |
| --- | --- |
| 86a0c9ac | The plan |
| d9a93490 | Step 1: the dark scheme and tokens, still off; print stays light |
| ff6c2d08 | Step 2: the app bar, drawer, footer and home tiles |
| 70c905f4 | Step 3: drawings re-inked or plated, exports unchanged |
| f8cb050b | Step 4: the public pages |
| 5bf9af1a | Step 5: the ritual reader and editors |
| 78f7b408 | Step 6: dark mode on, the drawer switch and the toolbar colour |
| 4f4d81c8 | The final review's fixes |
| (the next) | This plan brought up to date |
