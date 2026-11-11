The app's Hebrew text (the Lenain reader, the entity pages' names, the
editor trial) is set in Frank Ruhl Libre, which replaced FrankRuehl CLM on
11 November 2026 (plan 079). `scripts/hebrew-text-font/build.py` downloads
its variable font from google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (the commit the hall fonts and
Noto Emoji pin), checks its SHA-256, adds U+05C4 (HEBREW MARK UPPER DOT) as
the font's own holam dot centred over each letter, and subsets it to the
Hebrew block, keeping the weight axis and the `ccmp`, `locl`, `mark`, `mkmk`
and `kern` features. `FrankRuhlLibre.css` declares it.

| Source | SHA-256 |
| --- | --- |
| [`ofl/frankruhllibre/FrankRuhlLibre[wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/frankruhllibre/FrankRuhlLibre%5Bwght%5D.ttf) | f9bf26966681037aae894b031bd0dcf2c1bfdfa128dd0640cf276fe62a338a43 |

| File | Contents | Bytes | SHA-256 |
| --- | --- | --- | --- |
| FrankRuhlLibre-Hebrew.woff2 | weights 300–900; the font's 53 characters in U+0590–05FF and the added U+05C4 | 14316 | 710da63a963533d0b9daba4003f859031d63f48b26cf3ce976a0fbde95e0a4d5 |

Built with fontTools 4.66.1, Brotli 1.2.0 and uharfbuzz 0.56.2 (HarfBuzz
14.5.0), as the hall fonts are; other versions may produce different bytes.
The script checks with HarfBuzz that the upper dot lands over א, י, ל, ש and
ב at weights 300, 400, 700 and 900.

Frank Ruhl Libre has none of the cantillation marks (U+0591–05AF), nor
U+05C5 (lower dot) or U+05C6 (nun hafukha); a character it lacks falls to
the next font in the page's stack. Lenain's text uses one of them, U+0592,
twice.

The font is SIL Open Font License 1.1, Copyright 2015 The Frank Ruhl Libre
Project Authors (https://github.com/fontef/frankruhllibre), with no Reserved
Font Name, so the modified build keeps the name; `FrankRuhlLibre-OFL.txt` is
the upstream notice, written by `scripts/gd-hall-fonts/build.py`.
