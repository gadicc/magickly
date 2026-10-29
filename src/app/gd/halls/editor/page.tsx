import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import { Box, Container, Typography } from "@mui/material";
import Link from "next/link";
import OpenSource from "@/OpenSource";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { hallEditorJsonLd } from "@/seo/halls";
import JsonLd from "@/seo/JsonLd";
import { pageMetadata } from "@/seo/metadata";
import { GD_HALL_FONT_BASE } from "../fontBase";
import HallPlaygroundLoader from "./HallPlaygroundLoader";

export const metadata = pageMetadata("/gd/halls/editor");

/**
 * `/gd/halls/editor`: a Golden Dawn temple hall editor (plan 061, stage
 * E; on its own route since plan 062's amendment). Public and stateless
 * on the server: the hall lives in this browser's draft and travels in
 * share links' fragments. Browsing the halls is `/gd/halls`.
 */
export default function HallEditorPage() {
  return (
    <>
      <JsonLd data={hallEditorJsonLd()} />
      {/* The halls' label fonts, for every hall on the page. */}
      <style>{gdHallFontFaceCss(GD_HALL_FONT_BASE)}</style>
      <Container sx={{ px: 2, pt: 2 }} data-hall-page="text">
        <Typography variant="body2" sx={{ mb: 1 }}>
          An editor for Golden Dawn temple halls. Start from any of the{" "}
          <Link href="/gd/halls">fourteen halls</Link>, or build your own from
          composable tags in its Pug source or on the drawing. Download it as
          SVG or PNG: our artwork is{" "}
          <a href={GD_HALL_LICENCE.url}>{GD_HALL_LICENCE.name}</a>, free to use
          with credit to {GD_HALL_LICENCE.creator}.
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Your hall is kept as a draft in this browser only. To save it with its
          history, put it in a ritual: paste its Pug source into the ritual’s
          source, or insert a temple hall there with <code>/hall</code>. See the{" "}
          <Link href="/help/ritual-pug">Ritual Pug guide</Link>.
        </Typography>
        <noscript>
          <p>The hall editor needs JavaScript, which is off in this browser.</p>
        </noscript>
      </Container>
      {/* Outside the Container: split view takes the screen's full width,
          and the editor keeps to the text column otherwise. */}
      <Box sx={{ px: 2 }} data-hall-page="editor">
        <HallPlaygroundLoader />
      </Box>
      <Container sx={{ px: 2, pb: 2 }} data-hall-page="text">
        <OpenSource
          files={[
            "/src/app/gd/halls/editor/HallPlayground.tsx",
            "/src/doc/gdHallEditor/GdHallEditor.tsx",
            "/src/components/gd/hall/GdHall.tsx",
            "/src/components/gd/hall/presets/index.ts",
          ]}
        />
      </Container>
    </>
  );
}
