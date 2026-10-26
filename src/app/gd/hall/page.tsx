import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import { Box, Container, Typography } from "@mui/material";
import Link from "next/link";
import OpenSource from "@/OpenSource";
import { pageMetadata } from "@/seo/metadata";
import { GD_HALL_FONT_BASE } from "./fontBase";
import HallGallery from "./HallGallery";
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
      <Container sx={{ px: 2, pt: 2 }} data-hall-page="text">
        <Typography variant="body2" sx={{ mb: 1 }}>
          Golden Dawn temple halls, drawn from layouts as data with our own
          artwork. Start from a preset and edit it on the drawing or in its Pug
          source, then export it, copy its Pug, or share a link to it.{" "}
          <Link href="#halls">Browse the presets</Link>, each with a page of its
          own.
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
      </Container>
      {/* Outside the Container: split view takes the screen's full width,
          and the editor keeps to the text column otherwise. */}
      {/* At least the screen below the app bar, whether the editor or its
          loading note is in it, so the gallery below starts out of view
          and does not move when the editor arrives (plan 062). */}
      <Box
        sx={{ px: 2, minHeight: "calc(100vh - 64px)" }}
        data-hall-page="editor"
      >
        <HallPlaygroundLoader />
      </Box>
      <Container sx={{ px: 2, pb: 2 }} data-hall-page="text">
        <HallGallery />
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
