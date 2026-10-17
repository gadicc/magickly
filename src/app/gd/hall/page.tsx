import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import { pageMetadata } from "@/seo/metadata";
import { GD_HALL_FONT_BASE } from "./exportFonts";
import HallGallery from "./gallery";

export const metadata = pageMetadata("/gd/hall");

export default function HallPage() {
  return (
    <>
      {/* The halls' label fonts, for every hall on the page. */}
      <style>{gdHallFontFaceCss(GD_HALL_FONT_BASE)}</style>
      <HallGallery />
    </>
  );
}
