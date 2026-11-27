# The tablet in 3D — 26 November 2026

Status: draft, 26 November 2026. Plan 095's stretch goal (Gadi,
23 November 2026). Gadi accepted the invariants in principle and chose
the look from the spike's frames (26 November 2026, below). A value
review (Fable 5.2, high, 26 November) reshaped the draft; its changes
are marked "(value review)". Gadi signed off the invariants and the
size ceiling as revised (27 November 2026). A correctness review (fresh
Opus 5.5, high, 27 November) found two blockers, the sheet's outline ink
and how the build check finds three, and a set of fixes, all taken and
marked "(correctness review)". Next: the build on `gate/101-tablet-3d`,
with a phone-width mock-up of the switches before stage 4. Read
[current status](000-current-status.md) and
[plan 095](095-tablet-pyramids.md) first. The number was free on every
branch when drafted.

## Background

`/enochian/tablets` draws a tablet as truncated pyramids, flat, as the
Order's plates do (`?pyramids=1`, plan 095). Each square has four sides
in its attributions' colours, sides 1 to 4 on the left, top, right and
bottom (Regardie vol. 4, p.293), each with its symbol in the
complementary colour (`?symbols=1`), and the letter on a flat top. The
stretch goal is the same tablet in real 3D, which the reader can turn and
zoom on a desktop and a phone.

On 26 November 2026, before the spike, which way the symbols face was
corrected (plan 095, the correction at the end of its symbols item;
`01844766`): each stands on its side's outer edge, head toward the top,
as Regardie's drawings have them (vol. 4, pp.294 and 296). That is what
a slanted face wants, and `PYRAMID_SYMBOL_TURNS` in magick-components
records it.

### What Gadi decided (26 November 2026)

- **In the app, not in magick-components**, for now; it may move once it
  has settled.
- **Lights, reflections, shadows and shading**, which rules out SVG: the
  view uses WebGL.
- **A flat "relief" mode** (embossed letters and symbols) maybe later;
  the pyramids are the point.
- **WebXR is a stretch goal**: all the tablets in their quarters, the
  Tablet of Union on the altar. Not built here, but the few choices that
  would otherwise have to be undone are fixed now (below).
- **Phones:** he liked one finger to turn the tablet, and thought a full
  window might be easiest. The plan gives one-finger turning to the full
  window and leaves the page's scroll alone inline (value review, below).
- **Other 3D and WebXR features will follow.** What they would share sits
  in a small base, built with its first user, not designed ahead of it.
- **The look:** a pyramid height of a sixth of the square, a satin
  finish, and the light 60° above the tablet (below).

## The spike (26 November 2026)

A throwaway worktree, never to land (`magickli-spike-3d`, detached from
`b0cac724`): three.js 0.187.0, the whole tablet behind a button, and
measuring scripts. It rendered with SwiftShader, Chromium's software
renderer, so its times bound the code paths, not phones.

| Measure | Result |
| --- | --- |
| three.js, gzip | 136 KB, in two chunks |
| All the lazy JS, gzip | about 165 KB |
| The flat page's first load | +1 KB gzip (the loader) |
| Precached by the service worker | all five 3D chunks, until `excludeChunks` was set; then none |
| The mark sheet (66 symbols, 43 letters) | 22.6 KB gzip as SVG; rasterised in 45–130 ms |
| Frames drawn while idle, 5 s | 0 |
| Draw calls | 2 (3,124 triangles) |
| Click to first frame, 1× / 4× CPU throttle | 1.13 s / 1.35 s (most of it SwiftShader's first frame) |
| Context loss | recovers and draws again |
| Graphics memory | sheet at 256 px cells about 38 MB; canvas at 3× pixel density about 99 MB |

What the frames showed (the spike's scratch `frames/`; those sent to
Gadi are summarised here):

- **Height.** At a sixth of the square the tops read best and the
  symbols are still clearly slanted; at a quarter and a third the near
  rows' ridges hide the far rows' tops from a low angle.
- **Shadows.** No pyramid shadowed its neighbour at any height and light
  tried, down to a light 35° up. Shading (how each face turns to the
  light) does the visible work; a shadow map would cost a pass and memory
  for nothing seen.
- **Finish.** In matte, Earth's black sides read as holes and white sides
  merge with white tops; in satin they read as faces. Satin glared with a
  35° light, not at 60°.
- **Distance.** The far rows blur at a glancing angle; anisotropic
  filtering at 8 and a mipmap bias of −0.5 to −1 keep them legible.

### The look (Gadi, 26 November 2026)

Gadi chose the recommendation:

- a height of a sixth of the square, the top a third of it, as the flat
  drawing's with symbols (`PYRAMID_TOP_SYMBOLS`);
- a satin finish (roughness about 0.45, metalness about 0.05), with
  three's `RoomEnvironment` as an environment map for soft reflections;
- one directional light 60° above the tablet, fixed to it, so turning the
  view never changes which faces are lit;
- no cast shadows;
- sheet cells of 128–192 px, and pixel density capped at 2.

The recommendation also had darker valleys where pyramids meet and thin
lines along the ridges and round the tops. The spike drew neither, so
Gadi has not seen them (value review). Stage 3 sends him frames with and
without each; shader lines alias on the far rows and cannot be unit
tested, so the edge lines come in only if the frames earn them.

From stage 3's frames Gadi chose (27 November 2026):

- **The valleys, darkened to 0.35, and no edge lines.** The lines added
  noise on the far rows and nothing near; their code was cut.
- **The Squares tab's thicker `MARK_OUTLINES`**, not the flat tablet's
  `TABLET_MARK_OUTLINES`: thin outlines vanish on the larger 3D faces.
- **No outline in the mark's own colour** ("C" of four frames). Where a
  side's outline is the same colour as its ink (Earth's white on black,
  Spirit's and the blank sides' black on white), a thick outline only
  fattened the mark, and open spokes, dots and counters filled in. Those
  marks take the side's own `PYRAMID_COLOURS` ground as their outline,
  so the outline vanishes and the mark keeps its drawn width. A grey
  outline ("D") was tried and read as a halo. Coloured marks (Fire's,
  Water's and Air's) keep their black outlines. `model.test.ts` checks
  the rule on every side of every tablet in the three versions with
  pyramids. One consequence, accepted: the moon's crescent, hollow in
  the font, shows hollow in 3D, where the flat drawing's same-colour
  outline nearly fills it.

## Invariants (signed off, 27 November 2026)

1. **One source.** Every colour, ink, symbol, letter and top size comes
   from the code the flat drawing uses: `tabletPyramids` (magick-data)
   and `PYRAMID_COLOURS`, `inksOf`, `sideSymbol`, `SideMark` and
   `PYRAMID_TOP_SYMBOLS` (magick-components). The symbols' facing agrees
   with `PYRAMID_SYMBOL_TURNS`. The geometry test compares every side's
   colour, ink and mark, and each symbol's head direction projected flat,
   against those sources; the committed mark sheet is regenerated and
   compared by a test. (Value review: an import and literal scan was
   dropped, since a turn table cannot be detected mechanically and the
   ground and background need literals of their own.)
2. **Same data, same plan.** The 3D view draws `tabletPyramids(view)` for
   the version and tablet on the page, always with its symbols. Seen from
   straight above, ignoring height, every corner of every pyramid lies on
   the flat drawing's outline of that square drawn with symbols (top a
   third), and no mark is stretched: each mark keeps its width-to-height
   ratio on its face. (Value review: the flat top is a half without
   symbols, so 3D always carries them.)
3. **The flat page pays nothing.** Until the reader asks for 3D (the
   switch, or `3d=1` in a link they opened), no page loads three.js or
   the 3D code or creates a WebGL context, and the service worker
   precaches none of it. A check after `next build` holds the first two
   for every page; the first-load growth (the loader, about 1 KB gzip) is
   measured once by hand, since a build has no baseline to compare with.
4. **Never the only way, never a trap.** Everything the 3D view shows is
   also in the flat drawing and the panel. On a touch screen the page
   scrolls past the view, and the keyboard can always leave it. What 3D
   does not draw (reading-order numbers, regions) and the switches it
   rests are said in a line under it. Without WebGL, or when loading
   fails, the flat drawing returns and a line says why.
5. **Draw only on change.** A frame is drawn for an input event, a
   resize, a theme change, the sheet arriving or a restored context, and
   never while idle. There is no inertia, so the loop draws one frame
   per event and stops; reduced motion has nothing left to switch off,
   and *Reset* jumps.

## Size ceiling (signed off, 27 November 2026)

Enforced:

| Budget | Ceiling | How | Spike |
| --- | --- | --- | --- |
| Lazy JS, gzip, three and the sheet included | ≤ 200 KB | the build check | about 165 KB |
| Service worker precache of three or 3D chunks | 0 | the build check | 0 with `excludeChunks`; built with `exclude` (below) |
| Production lines (TS/TSX under `src/three/`, `tablets/three/` and `scripts/tablet3d/`, not tests or generated files) | ≤ 1,500 | counted at review | about 740 (untidy) |

Accepted by hand before landing: the first frame within 1 s of the
click at 4× CPU throttle on a GPU; 60 fps while turning on Gadi's phone;
the first load's growth. Texture memory follows from the 192 px cells:
about 24 MB for the sheet. (Value review: the
"+10%" ratchet, draw calls, the sheet's own limit, texture memory and a
sub-limit for the base were dropped as redundant or unenforceable.) The
192 px is already in device pixels, so the density cap does not enter
the sheet's figure; it bounds the canvas (correctness review).

Past any of these, cut scope (below, in order) before going on.

## The design

### Rendering

three.js core only (`three`, pinned exactly at `0.187.0`, released
30 October 2026, so clear of `minimumReleaseAge`), used directly. No
react-three-fiber: its React peer range ends at 19.3, which this app's
19.3.1 meets today but which would hold back the next React upgrade, and
one imperative scene drawn on demand gains little from a reconciler. No
drei (many dependencies for little here), no troika (the text is already
outlined), no `OrbitControls` (it sets `touch-action: none` on the
canvas, which would trap the page's scroll, and its keys pan rather than
turn; value review). WebGL 2 through `WebGLRenderer`, not WebGPU, which
is still patchy on phones and not needed here.

- **One merged mesh** for the whole tablet, from typed arrays: each
  square's four sides and top, with per-vertex colour, the mark's sheet
  cell, its ink and its outline colour, a highlight attribute per square
  (below), and, if the frames earn it, a valley-darkening factor. The
  ground under the tablet is the second draw call. `PYRAMID_COLOURS` and
  the inks are sRGB hex; they are converted to linear once, in `model.ts`,
  and the tests compare after that conversion (correctness review).
- **One material:** `MeshStandardMaterial`, patched in `onBeforeCompile`
  to sample the mark sheet, paint each mark's ink and outline from it,
  and tint highlighted squares. No second pass, no post-processing.
- **The highlights' tints** (stage 4). The page's highlights become a
  colour and an amount for each square (`highlights.ts`), copied to
  that square's vertices on the CPU in one `vec4` attribute, updated
  in place, not by a per-square attribute and a lookup. The view
  redraws only when a tint changed, so a page render with the same
  highlights draws nothing (invariant 5).
- **The mark sheet has two channels** (correctness review): red is the
  ink's coverage and green the outline's, on black, as the spike drew
  it. `inksOf` gives every mark both an ink and an outline
  (`pyramidMarks.tsx`), and Fire's, Water's and Air's black outlines are
  what give their green, orange and violet marks their contrast, so a
  one-channel mask tinted by the ink alone would lose them. The texture
  is uploaded as `NoColorSpace`, so coverage is not gamma-decoded. The
  marks use `TABLET_MARK_OUTLINES`, the flat tablet's widths, and stage
  3's frames show whether the larger 3D faces want the Squares tab's
  `MARK_OUTLINES` instead.
- **The sheet is drawn once by a committed script**, from the same
  `SideMark` and letters the flat drawing uses. The script outlines text
  to paths with the image route's `outlineComponentImage`
  (`src/render/outlineTreeImage.ts`) and its pinned fonts, passing
  `FrankRuhlLibre-Bold-letters.ttf` for the letters as `registry.tsx`
  does. That module imports `server-only`, so the script needs a narrow
  resolve hook for it, as the spike's did, and tests use
  `vi.mock("server-only")`. A pure `sheetModule()` is shared by the
  script and its test, as `grammarModule` is (`grammar.test.ts`). The
  result is committed as a generated module (an SVG string and its cell
  map), as `grammar.generated.ts` is, and rasterised in the browser. The
  test regenerates it and compares, and also fails on a blank cell,
  since a missing glyph outlines to nothing. Generating the sheet at
  build would put the font pipeline in front of every typecheck, test
  and dev start.
- **Render on demand** through `renderer.setAnimationLoop`, set only
  while there is a frame to draw and cleared after it. That loop rather
  than `requestAnimationFrame` is what WebXR needs later.
- **One renderer per page.** Changing tablet, version, theme or
  highlights updates the mesh's attributes or rebuilds the geometry in
  the same renderer; a new WebGL context is never made, since browsers
  cap them. Opening the full window moves the canvas, not a copy.
- **Density** is capped at 2, and the canvas is sized from a
  `ResizeObserver`. On `webglcontextlost` the view keeps its state, and
  on `webglcontextrestored` it draws again. three re-uploads buffers and
  textures by itself, but the environment map's render target comes back
  empty, so the view regenerates it (correctness review). Everything is
  disposed of when the view closes.

### Where it lives

```text
src/three/                        no React, no tablet; built with the view
  viewer.ts                       renderer, on-demand loop, resize, density,
                                  context loss and restore, dispose
  orbit.ts                        pointer and keyboard turning and zoom, reset
src/app/enochian/tablets/three/
  pyramidGeometry.ts              pure typed arrays from the model; no three import
  model.ts                        the tablet's pyramids as plain data, from
                                  tabletPyramids and the marks' modules
  marksSheet.generated.ts         the committed sheet (SVG string, cell map)
  tabletObject.ts                 mesh and material in tablet-local axes;
                                  pick(ray) → square
  Tablet3D.tsx                    the view, inline and in the full window
src/app/enochian/tablets/
  Tablet3DLoader.tsx              dynamic(..., { ssr: false }); on first load,
                                  so outside three/ (correctness review)
scripts/tablet3d/sheet.mts        draws marksSheet.generated.ts
scripts/checkThreeBuild.mts       after next build: invariant 3, the JS ceiling
```

`next.config.ts` excludes the 3D chunk groups from Serwist's precache
(`excludeChunks`, by `webpackChunkName`, which takes in the split-out
three.js chunks). That match is by name. It breaks silently when another
feature shares three's chunks, and Serwist ignores an unknown name
without a warning, so the build check cannot trust names (value review,
correctness review).

**How the build check finds three** (correctness review). Next 16's
webpack build writes no `app-build-manifest.json`, and the client
reference manifests list chunk files, not modules. three's code is also
split across two chunks, and only one of them carries `__THREE__`, so
scanning chunk contents is fragile. Instead:

- A small client-side, production-only plugin in `next.config.ts`'s
  `webpack()` writes `.next/three-chunks.json` from
  `compilation.chunkGraph`. The file lists every chunk holding a module
  under `node_modules/three/`, `src/three/` or `tablets/three/`, and the
  async group's files for the gzip ceiling.
- `checkThreeBuild.mts` compares that list with the first load
  (`build-manifest.json`'s `rootMainFiles` and `polyfillFiles`, and every
  page's client reference manifest's `clientModules[].chunks`) and with
  the precache list in `public/sw.js`.
- It fails when the list is empty, so a renamed group or a lost import
  cannot pass vacuously.
- It runs inside `build`'s parentheses, after `checkProxyBuild.mts`
  (`&& node --import tsx scripts/checkThreeBuild.mts`), and must pass on
  Vercel too, as `checkProxyBuild.mts`'s `VERCEL` caveat does.
- It is webpack-only: `check:turbopack` has neither Serwist nor the
  plugin.
- Whether `webpackChunkName` survives `next/dynamic` is unverified (the
  spike used a plain `import()`). The module-keyed check holds either
  way, and stage 3 settles which form `excludeChunks` needs.

**Built with `exclude`, not `excludeChunks`** (stage 3). `excludeChunks`
drops every file of the named group, and webpack put a chunk that MUI
shares with the first load (3441) in the 3D group, so the page's own
code fell out of the precache. `next.config.ts` instead passes Serwist
`exclude: [/\.map$/, /^manifest.*\.js$/, isThreeAsset]`, Serwist's two
defaults kept, with `isThreeAsset` matching the files
`.next/three-chunks.json` lists. The build check gained a fourth rule:
every first-load chunk that is not a 3D chunk is precached. It also
reads chunk names with Vercel's `?dpl=` suffix removed, which had let a
deployment-tagged build pass without checking.

### On the page

- **The switch.** A *3D* switch joins *Draw as pyramids* and *Symbols on
  the sides*, shown only with pyramids and written to the URL as `3d=1`
  like them. It swaps the flat drawing, in the same box, for the 3D view:
  one element or the other is rendered, never both with one hidden
  (layout rule 4). It follows the *Symbols on the sides* pattern
  (correctness review): `write()` drops `3d` when pyramids turn off, so a
  `threeDWanted` state, like `symbolsWanted`, joins `urlKey` and `urlSeen`
  (`tablets.tsx`), `choose()` and the pyramids switch's `setChoice`, and
  turning pyramids back on restores it.
- **The box** (correctness review). The page's layout assumes the flat
  SVG:
  - In the Names tab, and in the Squares tab with pyramids,
    `.namesOpen .tablet` sticks with a top offset taken from the flat
    drawing's sigil (`--tablet-sigil`, `tablets.module.css`). That would
    hide the top third of a canvas under the app bar.
  - `--tablet-ratio`, `--tablet-fit` and `.tablet > svg` size an SVG.
  - `showSquares` and `useSquarePixels` read the SVG's ref, and do
    nothing in 3D.

  The 3D box therefore takes its height from an aspect ratio set by the
  grid, capped at the viewport's height less the app bar. It opts out of
  the sigil offset and does not stick, since a turned tablet has no fixed
  top edge to keep in view. The reading-order numbers that
  `useSquarePixels` gates are not drawn in 3D anyway.
- **What 3D does with the drawing's other jobs** (value review). The flat
  drawing is the page's working surface on all three tabs, through
  `highlights` (`tablets.tsx`). The 3D view takes the same `highlights`:
  it tints `squares`, `selected`, the chosen name's squares and the
  previewed squares, and a click calls `onSelect`, so names, differences
  and the Squares tab work as on the flat drawing. As there, `onSelect`
  fires only on the outlined `squares` unless `anySquare` is set, which
  the Differences tab relies on, and a chosen name dims the other squares
  (correctness review). The view does not draw reading-order numbers,
  regions or the sigil above the grid, and a line under it says so. It
  keeps `mirrorReversed` (the sheet has the letters mirrored).
- **What rests while 3D is on.** *Symbols on the sides*, *upright*,
  *Second letters*, the Enochian font and the Names tab's *Show the
  regions* rest, as *Second letters* does under pyramids today, and the
  line under the view names them. NamesPanel draws nothing with the
  symbols and only builds links from them, so it keeps the reader's own
  choice and gets `threeD` too: a square's link opens the same view in a
  new tab as in this one (stage 4 review). The export box is hidden: there is one
  instance, keyed `export`, and `ExportControls` has no disabled state,
  only "Nothing to export yet." for a missing target, which would
  mislead. The line under the view says that turning 3D off exports the
  flat drawing (correctness review).
- **Mouse, inline.** Drag turns the tablet; Ctrl with the wheel, or a
  trackpad pinch (Ctrl and the wheel in Chromium and Firefox,
  `gesturechange` in Safari), zooms; the plain wheel scrolls the page; a
  click picks. A movement threshold tells a click from a drag, and the
  wheel listener is non-passive so a zoom can stop the page scrolling
  (correctness review).
- **Touch, inline** (value review). A tap picks, and the page scrolls as
  usual. Turning on a touch screen is the full window's. One gesture
  grammar per place, and the Safari risk nobody here can test shrinks.
- **Full window.** A fixed dialog (`100dvh`). One finger turns, two
  fingers zoom, and the plain wheel zooms. No picking there, so nothing
  chosen is out of sight (value review). Opening it pushes a history
  entry, its state merged with the page's own `tabletsTab` key; Next's
  patched `pushState` keeps custom keys. Back closes it, Close and Esc
  call `history.back()`, and a stale entry left by a reload is cleared.
  Focus moves in and returns to the button. Safe areas are not used: the
  site's viewport sets no `viewport-fit=cover` (`Document.tsx`), so
  `env(safe-area-inset-*)` is 0 (correctness review).
- **Buttons.** *Reset* and *Full window* on the view, 44 px on a touch
  screen, with one line of instructions for the input in use.
- **Keyboard.** With the view focused, the arrows turn the tablet, +
  (or =) and − zoom, and 0 resets.
- **For screen readers.** A focusable wrapper around the canvas carries
  `aria-roledescription` ("3D view"), the tablet's name ("The Fire tablet
  as pyramids, in 3D") and a description of the keys, rather than
  `role="img"`, which suits nothing a reader drives with keys
  (correctness review). The canvas itself is `aria-hidden`, and the
  panel stays the accessible reading.
- **Theme.** The background and ground follow light and dark; a theme
  change redraws.
- **Without WebGL.** If WebGL is missing or the context cannot be made,
  the switch turns itself off, the flat drawing returns, and a line says
  the browser cannot show the 3D view. Nothing probes WebGL before the
  reader asks (invariant 3).

The switch row grows to six switches. Before stage 4 Gadi gets a
mock-up at 320, 375 and 1,440 px of the row and the inline box, light and
dark (value review).

From the mock-up Gadi chose (27 November 2026) to put the switch, labelled
*In 3D*, straight after *Draw as pyramids*, rather than at the end of the
row: it sits by the switch it depends on, the resting symbols switches
follow it, and at 375 px it shares the pyramids line.

### For WebXR later (fixed now, not built)

- **Tablet-local axes.** `tabletObject.ts` builds the tablet in its own
  frame: one unit a square, x across the columns, z down the rows, y up,
  the origin at the tablet's centre. Placing a tablet in its quarter, or
  the Union flat on the altar (plan 061: in the East in the Portal's
  first part, on the altar late in its second), is a transform, not a
  rebuild.
- **The loop** is `setAnimationLoop` (above).
- **Picking by ray.** `pick(ray)` takes a ray in tablet-local space and
  returns a square, so a controller's ray works as the mouse's does. It
  steps along the ray through the squares it crosses and tests each one's
  pyramid. A hit on the ground plane alone would give a raised face to
  the square behind it at a low angle (correctness review).
- **No DOM in the tablet object.** `tabletObject.ts` and
  `pyramidGeometry.ts` know nothing of the page; only `Tablet3D.tsx` and
  `src/three/orbit.ts` do.

## Cut from v1

react-three-fiber, drei, `OrbitControls`, WebGPU, SDF text, extruded
glyphs, damping and inertia, a movable light, cast shadows, a reflective
floor, post-processing, the relief mode, WebXR, auto-rotation, the
camera in the URL, picking in the full window, and turning inline on a
touch screen.

If the ceiling is near, cut in this order: the inline view (3D only in
the full window, which removes the swap and most of the highlights work),
the environment map (keep the light's highlight), then the valley
darkening.

## Stages

Each stage commits on `gate/101-tablet-3d` with its tests passing and
its own interface text translated into Hebrew (`pnpm i18n:check`, in the
quick gate, fails on a missing message). The full gate runs before
landing.

1. **Dependency.** `three@0.187.0`, and `@types/three@0.187.0`
   (30 October) as a devDependency, both pinned exactly, by the house
   recipe for `minimumReleaseAge`. The types pull in
   `@dimforge/rapier3d-compat` (7.5 MB, types only here) and an
   open-ranged `@types/webxr`; the lockfile pins both (correctness
   review).
2. **Data, no three.** `model.ts`, `pyramidGeometry.ts`, the sheet script
   and its committed output, with their tests.
3. **The scene, inline, mouse only.** `src/three/viewer.ts` and
   `orbit.ts` with their first user: `tabletObject.ts`, `Tablet3D.tsx`
   behind the loader, the fallback, `excludeChunks` and
   `checkThreeBuild.mts` and its webpack plugin, so the guard lands with
   the first lazy import. With no switch yet, the view mounts when the
   URL has `3d=1` (read here, written from stage 4), so the build has a
   3D chunk to check (correctness review). The with-and-without frames
   for the valleys and edge lines, and the outline widths, go to Gadi
   here.
4. **On the page.** The switch and `3d=1`, highlights and picking, the
   resting switches and their line, accessibility. After the mock-up.
5. **Full window, touch and keyboard.** The dialog, history entry and
   focus, the touch gestures, the keys.
6. **Finish.** A sentence about the 3D view in `TabletsText.tsx`, which
   is English only, as the hub is, so it takes no Lingui marking. Then the
   search embeddings republished by AGENTS.md's recipe, within its $2
   per-run and $12 daily ledger, with the changed `search-vectors/` rows
   and manifest committed. Then the browser checks below, and the size
   table filled in with what was measured. The highlights' strengths are
   tuned by eye here: they mix in linear light, so the chosen name's
   white veil at 0.72 reads about 0.86 against the flat drawing's.

## Tests

- **One source and same plan (invariants 1 and 2).** For every tablet
  and version with pyramids: one pyramid per square of `tabletPyramids`;
  each pyramid's corners, projected flat, on the flat drawing's outline
  of its square with symbols; every face's normal out and up; each side's
  colour, ink, outline and mark those of the sources, after the
  conversion to linear; each symbol's head, projected flat, pointing as
  `PYRAMID_SYMBOL_TURNS` turns it; each mark's width-to-height ratio on
  its face that of its cell; side 2 nearest row 0. The flat outline is
  read from the rendered drawing's `data-pyramid` polygons, with a
  tolerance for their rounding. `SQUARE` is 20 for every grid, the
  Union's 4 × 5 included. The versions with pyramids are `gd`,
  `regardie` and `equinox`, each with the Union.
  `marksSheet.generated.ts` equals what the script draws now, and no
  cell is blank.
- **Picking.** A ray down through each square's centre picks it. An
  oblique ray, from several low angles, aimed at the centre of each of a
  pyramid's faces picks that pyramid. A ray off the tablet picks nothing
  (correctness review).
- **The loop (invariant 5).** With a stub renderer: one event draws one
  frame and clears the loop; no frame without an event; a faked
  `webglcontextlost` then `webglcontextrestored` rebuilds and draws once;
  closing disposes of what was made. jsdom gets a `ResizeObserver`
  stub, and the new pure modules join `vitest.config.mts`'s coverage
  `include` (correctness review).
- **URL state.** `3d=1` is written and read only with pyramids, as the
  other switches are (`urlState.test.ts`).
- **The page.** The switch shows only with pyramids; turning it on loads
  only the loader at render (WebGL mocked); highlights reach the view and
  `anySquare` gates `onSelect` as on the flat drawing; the resting
  switches rest, the export box is gone and the line shows; turning
  pyramids off and on keeps `3d=1`; without WebGL the switch turns off and
  the line shows; Esc closes the full window through `history.back()`
  and focus returns.
- **After `next build` (invariant 3).** `checkThreeBuild.mts` reads the
  plugin's `three-chunks.json`, the build manifests and the service
  worker. It fails the build, as `checkProxyBuild.mts` does, when:
  - a three.js or 3D chunk is on any page's first load;
  - one is in the precache list;
  - the lazy JS is over the ceiling;
  - the list is empty.

  Its own test feeds it small made-up manifests that pass and fail.
- **In a browser, by hand** (value review: not a committed script, which
  nothing would run and which would need a hook in production code). With
  headless Chromium over CDP (`scripts/docs-screenshots/browser.mts`), a
  first frame, a drag that turns, and idle frames over five seconds; then
  the page at 375, 768 and 1,440 px in light and dark, Gadi's phone for
  the frame rate, and 4× CPU throttle on a GPU for the first frame. The
  results are recorded in this plan. There is no Safari device here:
  Safari ships on the platform rules (WebGL 2 since Safari 15), and the
  gap is stated in the landing note.

## Risks

- **First frame on phones.** Most of the spike's first second was
  SwiftShader; a phone GPU should be far quicker, but shader compilation
  on a cold phone is the unknown. A loading state shows at once. The
  environment map's generation is timed on the phone too.
- **Graphics memory on small phones.** Density 2 and 192 px cells keep
  the sheet near 24 MB and the full-window canvas near 45 MB. Below
  192 px, the letters soften first.
- **three's churn.** Minor three.js releases often break things; it is
  pinned exactly and upgraded on purpose.

## Out of scope (follow-ups, each with its trigger)

These go into `plans/000-current-status.md`'s follow-ups when the plan
is agreed.

- The relief mode (height 0, embossed marks): when Gadi asks for it.
- WebXR, the tablets in their quarters and the Union on the altar: when
  the WebXR work starts.
- Turning inline on a touch screen: if readers ask for it after the full
  window ships.
- Picking in the full window: if the caption's value shows up in use.
- The tablets' own pages linking to the 3D view (`pyramids=1&3d=1`): when
  the 3D view has landed.
- A movable light and cast shadows: if a lower light is ever wanted.
- Moving the view into magick-components: once a second app wants it.
