import { GdHall, gdHallFontFaceCss } from "@magick-components/gd/hall";
import type { HallNode } from "@magick-components/gd/hall/types";
import { gdHallArt } from "@/app/gd/hall/art";
import { GD_HALL_FONT_BASE } from "@/app/gd/hall/fontBase";

const fontFaces = gdHallFontFaceCss(GD_HALL_FONT_BASE);

/**
 * The hall drawn with the app's art: `GdHallFrame`'s lazily loaded chunk.
 * The labels' `@font-face` rules go in one hoisted `<style>` per page
 * (React dedupes it by `href`), not into each SVG.
 */
export default function GdHallDrawing({ hall }: { hall: HallNode }) {
  return (
    <>
      <style href="gd-hall-fonts" precedence="default">
        {fontFaces}
      </style>
      <GdHall hall={hall} art={gdHallArt} />
    </>
  );
}
