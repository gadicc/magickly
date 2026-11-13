import { Container, Typography } from "@mui/material";
import BreakableName from "@/explorer/BreakableName";
import { EXPLORER_COMPONENTS } from "@/explorer/components";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Link from "@/ui/Link";
import ComponentsText from "./ComponentsText";
import styles from "./components.module.css";
import Thumbnail from "./Thumbnail";

export const metadata = pageMetadata("/open-source/components");

/**
 * `/open-source/components` (plan 080, decision 1): a tile for each
 * component in magick-components, linking to its explorer, then the text.
 */
export default function ComponentsPage() {
  return (
    <>
      <PageBreadcrumbs path="/open-source/components" />
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Typography variant="body1">
          The React components that draw the site&apos;s figures, each on a page
          of its own where you can try its props and copy the JSX.
        </Typography>
        <ul className={styles.tiles}>
          {EXPLORER_COMPONENTS.map((component) => (
            <li key={component.name}>
              <Link
                href={component.path}
                underline="none"
                // Fourteen pages' payloads are not worth fetching for a
                // glance at the index, as with the menus (7ced7fa1).
                prefetch={false}
                className={styles.tile}
              >
                <span className={styles.picture}>
                  <Thumbnail component={component} />
                </span>
                <span className={styles.caption}>
                  <span className={styles.name}>
                    <BreakableName name={component.name} />
                  </span>
                  <span className={styles.title}>{component.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
      <ComponentsText />
    </>
  );
}
