import { Box, Typography } from "@mui/material";
import type { SideElement } from "magick-components/enochian/pyramidMarks";
import { PYRAMID_COLOURS } from "magick-components/enochian/Tablet";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { SIDE_ELEMENT_WORDS } from "./pyramidWords";

/** The elements in the key's order, the Order's (vol. 4, p.294). */
const ELEMENTS: readonly SideElement[] = [
  "fire",
  "water",
  "air",
  "earth",
  "spirit",
];

/**
 * A colour's swatch, beside its word, which says it: a pyramid's lower
 * side, so that a white one does not read as an empty checkbox.
 */
function Swatch({ colour }: { colour: string }) {
  return (
    <Box
      component="svg"
      aria-hidden
      viewBox="0 0 20 12"
      sx={{ width: 20, height: 12, flex: "none", overflow: "visible" }}
    >
      <polygon
        points="0.5,11.5 5.5,0.5 14.5,0.5 19.5,11.5"
        // Grey, as the drawing's lines are, so white and black both show.
        style={{ fill: colour, stroke: "#888", strokeWidth: 1 }}
      />
    </Box>
  );
}

/**
 * The colours of the tablet drawn as pyramids (plan 095, decision 4, the
 * mock-up's K1): each element's, and the white of a Calvary square's
 * lowest side, which carries its Sephirah. In the page, translated and
 * read by screen readers, beside the switch that draws them; a download
 * carries no key.
 */
export default function PyramidKey() {
  const { t } = useUiLanguage();
  return (
    <Box
      component="ul"
      aria-label={t(/*i18n*/ "The pyramids' colours")}
      data-pyramid-key=""
      sx={{
        listStyle: "none",
        p: 0,
        m: 0,
        mt: 0.5,
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1.75,
        rowGap: 0.5,
        typography: "body2",
      }}
    >
      {ELEMENTS.map((element) => (
        <Box
          component="li"
          key={element}
          sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
        >
          <Swatch colour={PYRAMID_COLOURS[element]} />
          {t(SIDE_ELEMENT_WORDS[element])}
        </Box>
      ))}
      <Box
        component="li"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flexBasis: "100%",
        }}
      >
        <Swatch colour={PYRAMID_COLOURS.none} />
        <Typography component="span" variant="body2">
          {t(
            /*i18n*/ "White, with no element: a Calvary square's lowest side, which carries its Sephirah",
          )}
        </Typography>
      </Box>
    </Box>
  );
}
