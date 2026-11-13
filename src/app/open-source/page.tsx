import { Container } from "@mui/material";
import { pageMetadata } from "@/seo/metadata";
import OpenSourceText from "./OpenSourceText";

export const metadata = pageMetadata("/open-source");

/** The open-source hub: the packages, and what may be reused (plan 080). */
export default function OpenSourcePage() {
  return (
    <>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <p>
          Magick.ly is open source. Its code is public, and the parts most worth
          reusing elsewhere, the data and the components that draw from it, are
          under freer licences than the app, so that they can travel. The data
          is on npm; the components will follow.
        </p>
      </Container>
      <OpenSourceText />
    </>
  );
}
