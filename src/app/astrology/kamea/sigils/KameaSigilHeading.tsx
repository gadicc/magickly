import { Container, Typography } from "@mui/material";
import UiText from "@/i18n/UiText";

/**
 * The generator's own heading. The app bar heads a page from the site's
 * titles, which have no Kamea section until the kameas' hub (plan 093,
 * K4) gives `/astrology/kamea` a page; until then the bar names the
 * section, Astrology, and the page names itself, as an entity page does.
 */
export default function KameaSigilHeading() {
  return (
    <Container sx={{ pt: 2 }}>
      <Typography component="h1" variant="h5">
        <UiText message={/*i18n*/ "Kamea Sigil Generator"} />
      </Typography>
    </Container>
  );
}
