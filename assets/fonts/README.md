# Server-only rendering fonts

These fonts are read only by the component image renderer
(`src/render/outlineTreeImage.ts`) for the components that declare them. They
live outside `public/` on purpose: nothing serves them by URL and the service
worker never precaches them. The renderer's shared base fonts stay in
`public/fonts` because the interactive Tree of Life SVG refers to them by URL.

| File | Used by | Source | SHA-256 |
| --- | --- | --- | --- |
| NotoEmoji-Variable.ttf | `table-of-shewbread` (four kerub emoji) | [Noto Emoji `NotoEmoji[wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf) from google/fonts commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`, downloaded 2026-09-16 | de6c18832938afc99caf132b39d6a30a19bac7f2e812e28db2535b4608d27551 |
| EnochianPlain.ttf | `enochian-tablet?font=enochian`, `gd-hall` (the tablets) | See `EnochianPlain-NOTICE.txt` | 82ff69cdfbe0fb8157e400120164cddc7ce6227ef054d86a92efae1340d7be9e |
| NotoSerif-Italic-latin1.ttf | `gd-hall` (labels and captions) | `scripts/gd-hall-fonts/build.py`; see below | b17042575847967023a24dba5b9b4b16aa9fe9a627005acfed7b18ca2c48c6b9 |
| NotoSerif-BoldItalic-compass.ttf | `gd-hall` (the compass labels) | `scripts/gd-hall-fonts/build.py`; see below | d443ee9985cdaf7c3aa1120bfb3971b8f4f1b42896bf2c07cec5833b3336f475 |
| NotoSerifHebrew-Bold-letters.ttf | `gd-hall` (Hebrew-letter banners) | `scripts/gd-hall-fonts/build.py`; see below | 13c7ddab852ce3a9d6e0d02fab9fa21a35c6eef210dd57579c7e43d9074d5573 |

Noto Emoji is the monochrome emoji family, variable weight 300–700 with the
Regular (400) default that the renderer uses. `NotoEmoji-OFL.txt` is its
upstream SIL Open Font License 1.1 notice (Copyright 2013 Google LLC, no
reserved font names). Add a font here only through the `SERVER_FONT_FILES`
list and a registry entry; the loader refuses any other name.

The three Noto Serif files are the temple halls' label subsets as TrueType
(plan 062): resvg reads no WOFF2. `scripts/gd-hall-fonts/build.py` writes
them in the same run, from the same static instances and subsets, as their
WOFF2 twins in `public/fonts`, whose sources, versions and hashes
`public/fonts/Noto-hall-sources.md` records; `fontMetrics.json` measures
both. Their licence is the SIL Open Font License 1.1 in
`public/fonts/NotoSerif-OFL.txt` and `NotoSerifHebrew-OFL.txt`.
