The temple-hall diagrams (`src/components/gd/hall`, plan 061) draw their
labels and caption in Noto Serif Italic, the compass labels in Noto Serif Bold
Italic and the Hebrew-letter banners in Noto Serif Hebrew Bold. google/fonts
ships these families only as variable fonts, so
`scripts/gd-hall-fonts/build.py` downloads them from google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (the commit
`assets/fonts/README.md` pins for Noto Emoji), checks their SHA-256, makes
static instances (width 100) with the fontTools instancer and subsets them.
The subsets keep only the `kern` layout feature, so no renderer can form
ligatures, and keep the copyright and licence names.

| Source | SHA-256 |
| --- | --- |
| [`ofl/notoserif/NotoSerif-Italic[wdth,wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserif/NotoSerif-Italic%5Bwdth,wght%5D.ttf) | e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1 |
| [`ofl/notoserifhebrew/NotoSerifHebrew[wdth,wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserifhebrew/NotoSerifHebrew%5Bwdth,wght%5D.ttf) | 93caef921360788dc3b0e32136bb26f16bc57717ec482d48fc7fd43820617165 |

| File | Instance and subset | Bytes | SHA-256 |
| --- | --- | --- | --- |
| NotoSerif-Italic-latin1.woff2 | weight 400; U+0020–007E, U+00A0–00FF, U+2013–2014, U+2018–2019, U+201C–201D, U+2026 | 11464 | 9f950c9e9439445d096145d53dcb951ec3baa9d71efbd206a87c70d876e538dd |
| NotoSerif-BoldItalic-compass.woff2 | weight 700; the letters of "East West North South" | 2072 | f39a880b7b95a001802b1cb02f3ae8ffea9e656065a54f8d3bbd43b833d6ded0 |
| NotoSerifHebrew-Bold-letters.woff2 | weight 700; U+05D0–05EA (the 22 letters and 5 final forms) | 3340 | 8e6caa54f8ea7632995cb66eee7afbfbd2630581945fe6e45bea8ede53950e0f |
| ../../src/components/gd/hall/fontMetrics.json | advances and GPOS kern pairs (by class) of the two Latin subsets, in font units | 11345 | f09e8176fc9683b0e767fade3a94abdd3685661118a11bfb16db3c8216ee3d6a |

Built with fontTools 4.66.1, Brotli 1.2.0 and uharfbuzz 0.56.2 (HarfBuzz
14.5.1); other versions may produce different bytes. The script checks that
the kern table reproduces HarfBuzz's shaping, with ligatures off, for every
character pair and for a list of label strings.

`NotoSerif-OFL.txt` and `NotoSerifHebrew-OFL.txt` are the upstream SIL Open
Font License 1.1 notices from the same commit (Copyright 2022 The Noto Project
Authors; no reserved font names).
