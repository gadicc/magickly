import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import { Container, Typography } from "@mui/material";
import Link from "next/link";
import OpenSource from "@/OpenSource";
import { pageMetadata } from "@/seo/metadata";
import { GD_HALL_FONT_BASE } from "./fontBase";
import HallPlaygroundLoader from "./HallPlaygroundLoader";

export const metadata = pageMetadata("/gd/hall");

/**
 * `/gd/hall`: a Golden Dawn temple hall editor (plan 061, stage E). Public
 * and stateless on the server: the hall lives in this browser's draft and
 * travels in share links' fragments.
 */
export default function HallPage() {
  return (
    <>
      {/* The halls' label fonts, for every hall on the page. */}
      <style>{gdHallFontFaceCss(GD_HALL_FONT_BASE)}</style>
      <Container sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Golden Dawn temple halls, drawn from layouts as data with our own
          artwork. Start from a preset and edit it on the drawing or in its Pug
          source, then export it, copy its Pug, or share a link to it.
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Your hall is kept as a draft in this browser only. To save it with its
          history, put it in a ritual: paste its Pug source into the ritual’s
          source, or insert a temple hall there with <code>/hall</code> (Temple
          hall) and edit it in place. See the{" "}
          <Link href="/help/ritual-pug">Ritual Pug guide</Link>.
        </Typography>
        <noscript>
          <p>The hall editor needs JavaScript, which is off in this browser.</p>
        </noscript>
        <HallPlaygroundLoader />
        <OpenSource
          files={[
            "/src/app/gd/hall/HallPlayground.tsx",
            "/src/doc/gdHallEditor/GdHallEditor.tsx",
            "/src/components/gd/hall/GdHall.tsx",
            "/src/components/gd/hall/presets/index.ts",
          ]}
        />
      </Container>
    </>
  );
}
