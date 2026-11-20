/**
 * The rose's path digest (plan 093, K2's gate): one SHA-256 per rose and
 * one over both, of every figure the sigil oracle's report corpus draws on
 * the rose, plus the engine suite's collinear-run words. Run it before and
 * after a change to the engine that should leave the rose alone (a layout,
 * profile or placement setting the rose does not use); its output must not
 * change. Wider than the registry's pinned digest, which covers 87 texts:
 * best-effort figures depend on the work count, which a changed element
 * list would move.
 *
 * Each text, on each rose (`gd`, `regardie1939`), contributes its
 * version, the text, the SVG `SigilImage` renders with `ROSE_SIGIL_PROFILE`,
 * placement's `failures` and the figure's frame. The texts are the hand
 * fixtures, the templates, the 72 names, every pair and triple of the
 * rose's letters, the seeded random words of 4–12 letters, the domain's
 * edge words, every A-B-A-B-A word, the 13–32-letter words beyond the
 * domain and the collinear-run words: 15,537 texts a rose. It takes about
 * two minutes.
 *
 *     node --import tsx scripts/sigil-oracle/roseDigest.mts
 */

import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../packages/magick-components/src/gd/roseSigilLayout.ts";
import {
  ababaTexts,
  BEYOND_DOMAIN_CORPUS,
  collinearRunTexts,
  DOMAIN_EDGE_TEXTS,
  randomRoseTexts,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "../../packages/magick-components/src/sigil/oracle/corpus.ts";
import { HAND_FIXTURES } from "../../packages/magick-components/src/sigil/oracle/fixtures.ts";
import { PLAN_TEMPLATES } from "../../packages/magick-components/src/sigil/oracle/templates.ts";
import {
  SigilImage,
  sigilFigure,
} from "../../packages/magick-components/src/sigil/SigilImage.tsx";

const started = Date.now();
const all = createHash("sha256");
let count = 0;
for (const version of ["gd", "regardie1939"] as const) {
  const layout = roseSigilLayout(version);
  const texts = new Set<string>([
    ...HAND_FIXTURES.map((f) => f.text),
    ...PLAN_TEMPLATES.map((t) => t.text),
    ...SEVENTY_TWO_NAMES.map((n) => n.text),
    ...roseTexts(2, version),
    ...roseTexts(3, version),
    ...randomRoseTexts(),
    ...DOMAIN_EDGE_TEXTS,
    ...ababaTexts(version),
    ...randomRoseTexts(BEYOND_DOMAIN_CORPUS),
    ...collinearRunTexts(),
  ]);
  const hash = createHash("sha256");
  for (const text of texts) {
    const figure = sigilFigure(text, layout, ROSE_SIGIL_PROFILE);
    const svg = renderToStaticMarkup(
      createElement(SigilImage, {
        text,
        layout,
        profile: ROSE_SIGIL_PROFILE,
        figure,
      }),
    );
    const entry = `${version} ${text}\n${svg}\n${JSON.stringify(figure.failures)}\n${JSON.stringify(figure.frame)}\n\n`;
    hash.update(entry);
    all.update(entry);
    count++;
  }
  console.log(version, texts.size, hash.digest("hex"));
}
console.log("all", count, all.digest("hex"), `${Date.now() - started} ms`);
