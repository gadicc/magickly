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
| ../../assets/fonts/NotoSerif-Italic-latin1.ttf | the same subset as TrueType, for the server's image renderer (plan 062) | 26112 | b17042575847967023a24dba5b9b4b16aa9fe9a627005acfed7b18ca2c48c6b9 |
| ../../assets/fonts/NotoSerif-BoldItalic-compass.ttf | the same subset as TrueType | 3908 | d443ee9985cdaf7c3aa1120bfb3971b8f4f1b42896bf2c07cec5833b3336f475 |
| ../../assets/fonts/NotoSerifHebrew-Bold-letters.ttf | the same subset as TrueType | 6448 | 13c7ddab852ce3a9d6e0d02fab9fa21a35c6eef210dd57579c7e43d9074d5573 |
| ../../src/components/gd/hall/fontMetrics.json | advances and GPOS kern pairs (by class) of the three subsets, in font units | 10736 | 7e514c841ae2c761c0f0990f584a6a930d9dcd8d9e07a8d57245fea313270e90 |

Built with fontTools 4.66.1, Brotli 1.2.0 and uharfbuzz 0.56.2 (HarfBuzz
14.5.1); other versions may produce different bytes. The script checks that
the kern table reproduces HarfBuzz's shaping, with ligatures off, for every
character pair, for a list of label strings and for the Hebrew names on the
Pantacle's ring. The soft hyphen (U+00AD) is default-ignorable: HarfBuzz
draws it as nothing and kerns across it, so the table gives it no advance
and no kern pairs, and the labels' measurement skips it when kerning.

`NotoSerif-OFL.txt` and `NotoSerifHebrew-OFL.txt` are the upstream SIL Open
Font License 1.1 notices from the same commit (Copyright 2022 The Noto Project
Authors; no reserved font names).
