/**
 * Writes fonts/gd-hall.css, the hall fonts' `@font-face` rules with URLs
 * relative to the stylesheet, from GD_HALL_FONT_FILES (plan 080, decision
 * 7). A consumer's bundler emits and hashes the fonts it names:
 *
 *   import "magick-components/fonts/gd-hall.css";
 *
 * Run `pnpm --filter magick-components fonts:css` after changing the
 * subsets; fonts.test.ts holds the file equal to what this writes.
 */
import { writeFileSync } from "node:fs";
import { gdHallFontFaceCss } from "../src/gd/hall/fonts.ts";

writeFileSync(
  new URL("../fonts/gd-hall.css", import.meta.url),
  `${gdHallFontFaceCss(".")}\n`,
);
